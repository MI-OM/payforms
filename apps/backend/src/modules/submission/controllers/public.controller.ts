import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, BadRequestException, NotFoundException, UnauthorizedException, Headers, Header, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FormService } from '../../form/services/form.service';
import { SubmissionService } from '../services/submission.service';
import { PaymentService } from '../../payment/services/payment.service';
import { ContactService } from '../../contact/services/contact.service';
import { NotificationService } from '../../notification/notification.service';
import { PublicSubmitFormDto } from '../dto/submission.dto';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@ApiTags('Public')
@Controller('public')
export class PublicController {
  constructor(
    private formService: FormService,
    private submissionService: SubmissionService,
    private paymentService: PaymentService,
    private contactService: ContactService,
    private notificationService: NotificationService,
    private configService: ConfigService,
    private jwtService: JwtService,
  ) {}

  @Get('forms/:slug')
  async getPublicForm(@Param('slug') slug: string, @Headers('authorization') authorization?: string) {
    const form = await this.formService.findBySlug(slug);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    await this.ensurePublicFormAccess(form, authorization);

    return {
      id: form.id,
      title: form.title,
      category: form.category,
      description: form.description,
      note: form.note,
      slug: form.slug,
      payment_type: form.payment_type,
      amount: form.amount,
      allow_partial: form.allow_partial,
      access_mode: form.access_mode ?? 'OPEN',
      identity_validation_mode: form.identity_validation_mode ?? 'NONE',
      identity_field_label: form.identity_field_label ?? null,
      fields: form.fields,
    };
  }

  @Get('forms/:slug/widget-config')
  async getWidgetConfig(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Headers('authorization') authorization?: string,
  ) {
    const form = await this.formService.findBySlug(slug);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    await this.ensurePublicFormAccess(form, authorization);

    const baseUrl = this.resolvePublicBaseUrl(req);
    const encodedSlug = encodeURIComponent(form.slug);
    const formEndpoint = `${baseUrl}/public/forms/${encodedSlug}`;
    const submitEndpoint = `${baseUrl}/public/forms/${encodedSlug}/submit`;
    const widgetEndpoint = `${baseUrl}/public/forms/${encodedSlug}/widget`;
    const scriptEndpoint = `${baseUrl}/public/forms/${encodedSlug}/embed.js`;

    return {
      form: {
        id: form.id,
        title: form.title,
        category: form.category,
        description: form.description,
        note: form.note,
        slug: form.slug,
        payment_type: form.payment_type,
        amount: form.amount,
        allow_partial: form.allow_partial,
        access_mode: form.access_mode ?? 'OPEN',
        identity_validation_mode: form.identity_validation_mode ?? 'NONE',
        identity_field_label: form.identity_field_label ?? null,
        is_targeted: !!form.targets?.length,
        fields: form.fields,
      },
      endpoints: {
        form: formEndpoint,
        submit: submitEndpoint,
        widget: widgetEndpoint,
        embed_script: scriptEndpoint,
      },
      embed_code: `<script src="${scriptEndpoint}" data-payforms-widget data-callback-url="https://your-site.com/payment-callback"></script>`,
      events: ['ready', 'submitted', 'payment_initialized', 'error', 'resize'],
    };
  }

  @Get('forms/:slug/embed.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  async getEmbedScript(@Param('slug') slug: string, @Req() req: Request) {
    const form = await this.formService.findBySlug(slug);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const baseUrl = this.resolvePublicBaseUrl(req);
    return this.buildEmbedScript(form.slug, baseUrl);
  }

  @Get('forms/:slug/widget')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async getWidgetHtml(
    @Param('slug') slug: string,
    @Req() req: Request,
    @Query('callback_url') callbackUrl?: string,
    @Query('contact_token') contactToken?: string,
    @Query('contact_email') contactEmail?: string,
    @Query('contact_name') contactName?: string,
    @Query('auto_redirect') autoRedirect?: string,
  ) {
    const form = await this.formService.findBySlug(slug);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    await this.ensurePublicFormAccess(form, contactToken ? `Bearer ${contactToken}` : undefined);

    const baseUrl = this.resolvePublicBaseUrl(req);
    return this.buildWidgetHtml({
      slug: form.slug,
      baseUrl,
      callbackUrl,
      contactToken,
      contactEmail,
      contactName,
      autoRedirect: autoRedirect === undefined ? true : autoRedirect !== 'false',
    });
  }

  @Get('payments/callback')
  async handlePaymentCallback(
    @Query('reference') reference?: string,
    @Query('trxref') trxref?: string,
  ) {
    const resolvedReference = reference || trxref;
    if (!resolvedReference) {
      throw new BadRequestException('Payment reference is required');
    }

    const payment = await this.paymentService.findByReferenceGlobal(resolvedReference);
    if (!payment) {
      return {
        status: 'ignored',
        reason: 'payment_not_found',
        reference: resolvedReference,
      };
    }

    try {
      const result = await this.paymentService.verifyAndFinalizePayment(
        payment.organization_id,
        resolvedReference,
        'callback_redirect',
      );

      return {
        status: 'processed',
        reference: resolvedReference,
        skipped: !!result.skipped,
        payment: result.payment,
        verified: result.verified,
      };
    } catch (error: any) {
      return {
        status: 'error',
        reference: resolvedReference,
        message: error?.message || 'Verification failed',
      };
    }
  }

  @Post('forms/:slug/submit')
  @HttpCode(HttpStatus.OK)
  async submitPublicForm(
    @Param('slug') slug: string,
    @Body() dto: PublicSubmitFormDto,
    @Query('callback_url') callbackUrl?: string,
    @Headers('authorization') authorization?: string,
  ) {
    const form = await this.formService.findBySlug(slug);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (form.payment_type === 'FIXED' && !form.amount) {
      throw new BadRequestException('Form amount is not configured');
    }

    this.validateSubmissionData(dto.data, form.fields);

    const amount = form.payment_type === 'VARIABLE' ? dto.data.amount : form.amount;
    if (form.payment_type === 'VARIABLE' && (amount === undefined || amount === null)) {
      throw new BadRequestException('Amount is required for variable payment forms');
    }

    const tokenContactId = await this.ensurePublicFormAccess(form, authorization);
    let contactId: string | undefined = tokenContactId ?? undefined;

    const identityValidatedContactId = await this.validateIdentityRules(form, dto, tokenContactId);
    if (identityValidatedContactId) {
      contactId = identityValidatedContactId;
    }
    if (!contactId && dto.contact_email) {
      const contact = await this.contactService.findByEmail(form.organization_id, dto.contact_email);
      if (contact) {
        contactId = contact.id;
      } else {
        const nameSource = dto.data?.name || dto.contact_name || dto.contact_email;
        const nameParts = String(nameSource).trim().split(/\s+/).filter(Boolean);
        const firstName = nameParts[0] || dto.contact_email;
        const lastName = nameParts.slice(1).join(' ') || undefined;
        const createdContact = await this.contactService.createFromPublic(
          form.organization_id,
          firstName,
          lastName,
          dto.contact_email,
        );
        contactId = createdContact.id;
      }
    }

    const callback = callbackUrl || this.configService.get('PAYSTACK_CALLBACK_URL');
    if (!callback) {
      throw new BadRequestException('Callback URL is required');
    }

    const submission = await this.submissionService.create(form.organization_id, form.id, {
      data: dto.data,
      contact_id: contactId,
    });

    const payment = await this.paymentService.create(form.organization_id, {
      submission_id: submission.id,
      amount,
    });

    let paymentAuthorization: any;
    try {
      paymentAuthorization = await this.paymentService.initializePaystack(
        form.organization_id,
        payment,
        callback,
        dto.contact_email,
      );
    } catch (error: any) {
      await this.paymentService.markInitializationFailed(
        form.organization_id,
        payment.id,
        error?.message || 'Failed to initialize payment',
      );
      throw error;
    }

    const confirmationEmail = dto.contact_email;
    if (
      confirmationEmail &&
      form.organization &&
      form.organization.notify_submission_confirmation
    ) {
      try {
        await this.notificationService.sendSubmissionConfirmation(
          form.organization,
          confirmationEmail,
          form.title,
          amount,
          payment.reference,
        );
      } catch (error) {
        console.warn('Failed to send submission confirmation email:', error);
      }
    }

    return { submission, payment, authorization: paymentAuthorization };
  }

  private async getContactIdFromAuthHeader(authorization?: string): Promise<string | null> {
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    const token = authorization.replace(/^Bearer\s+/i, '');
    try {
      const payload = this.jwtService.verify(token);
      if (!payload?.sub || payload?.role !== 'CONTACT') {
        return null;
      }
      return payload.sub;
    } catch {
      return null;
    }
  }

  private async ensureTargetedFormAccess(form: any, authorization?: string): Promise<string | null> {
    if (!form.targets?.length) {
      return null;
    }

    const contactId = await this.getContactIdFromAuthHeader(authorization);
    if (!contactId) {
      throw new UnauthorizedException('Contact login required to access this targeted form');
    }

    const eligible = await this.formService.isContactEligible(form, contactId);
    if (!eligible) {
      throw new UnauthorizedException('Contact is not eligible for this form');
    }

    return contactId;
  }

  private async ensurePublicFormAccess(form: any, authorization?: string): Promise<string | null> {
    const tokenContactId = await this.getContactIdFromAuthHeader(authorization);
    if (form.targets?.length) {
      if (!tokenContactId) {
        throw new UnauthorizedException('Contact login required to access this targeted form');
      }
      const eligible = await this.formService.isContactEligible(form, tokenContactId);
      if (!eligible) {
        throw new UnauthorizedException('Contact is not eligible for this form');
      }
      return tokenContactId;
    }

    const accessMode = form.access_mode ?? 'OPEN';
    const requiresLogin = accessMode === 'LOGIN_REQUIRED' || accessMode === 'TARGETED_ONLY';

    if (requiresLogin && !tokenContactId) {
      throw new UnauthorizedException('Contact login required to access this form');
    }

    if (form.organization?.require_contact_login && !tokenContactId) {
      throw new UnauthorizedException('Contact login required to access this form');
    }

    return tokenContactId ?? null;
  }

  private validateSubmissionData(data: Record<string, any>, fields: any[]) {
    const errors: string[] = [];

    for (const field of fields || []) {
      const value = data[field.label];
      const isEmpty = value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

      if (field.required && isEmpty) {
        errors.push(`Field '${field.label}' is required.`);
        continue;
      }

      if (!isEmpty) {
        if (field.type === 'EMAIL' && typeof value === 'string') {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(value)) {
            errors.push(`Field '${field.label}' must be a valid email address.`);
          }
        }

        if (field.type === 'NUMBER') {
          const numericValue = typeof value === 'number' ? value : Number(value);
          if (Number.isNaN(numericValue)) {
            errors.push(`Field '${field.label}' must be a number.`);
          }
        }

        if (field.type === 'SELECT' && field.options?.length) {
          if (!field.options.includes(value)) {
            errors.push(`Field '${field.label}' must be one of: ${field.options.join(', ')}.`);
          }
        }
      }
    }

    if (errors.length) {
      throw new BadRequestException({ message: 'Invalid submission data', errors });
    }
  }

  private async validateIdentityRules(form: any, dto: any, tokenContactId?: string | null): Promise<string | null> {
    if (!form.identity_validation_mode || form.identity_validation_mode === 'NONE') {
      return null;
    }

    if (tokenContactId) {
      return tokenContactId;
    }

    if (form.identity_validation_mode === 'CONTACT_EMAIL') {
      if (!dto.contact_email) {
        throw new BadRequestException('contact_email is required for identity validation');
      }

      const contact = await this.contactService.findByEmail(form.organization_id, dto.contact_email);
      if (!contact) {
        throw new BadRequestException('Contact email does not match any registered contact');
      }

      return contact.id;
    }

    if (form.identity_validation_mode === 'CONTACT_EXTERNAL_ID') {
      if (!form.identity_field_label) {
        throw new BadRequestException('Form identity field label is not configured');
      }

      const identityValue = dto.data?.[form.identity_field_label];
      const isEmpty = identityValue === undefined || identityValue === null || (typeof identityValue === 'string' && identityValue.trim() === '');
      if (isEmpty) {
        throw new BadRequestException(`Field '${form.identity_field_label}' is required for identity validation`);
      }

      const contact = await this.contactService.findByExternalId(
        form.organization_id,
        typeof identityValue === 'string' ? identityValue.trim() : String(identityValue),
      );
      if (!contact) {
        throw new BadRequestException('Identity value does not match any registered contact');
      }

      return contact.id;
    }

    return null;
  }

  private resolvePublicBaseUrl(req: Request): string {
    const configuredBase =
      this.configService.get<string>('PUBLIC_API_BASE_URL') ||
      this.configService.get<string>('BACKEND_PUBLIC_URL');

    if (configuredBase) {
      return configuredBase.replace(/\/+$/, '');
    }

    const protocol = this.readForwardedHeader(req.headers['x-forwarded-proto']) || req.protocol || 'http';
    const host =
      this.readForwardedHeader(req.headers['x-forwarded-host']) ||
      req.get('host') ||
      'localhost:3001';

    return `${protocol}://${host}`.replace(/\/+$/, '');
  }

  private readForwardedHeader(value: string | string[] | undefined): string | null {
    if (!value) {
      return null;
    }

    const firstValue = Array.isArray(value) ? value[0] : value;
    const normalized = firstValue.split(',')[0].trim();
    return normalized || null;
  }

  private buildEmbedScript(slug: string, baseUrl: string): string {
    const bootstrap = JSON.stringify({
      slug,
      baseUrl,
    });

    return `(() => {
  const bootstrap = ${bootstrap};
  const script = document.currentScript;
  if (!script) {
    return;
  }

  const apiBase = script.getAttribute('data-api-base') || bootstrap.baseUrl;
  const callbackUrl = script.getAttribute('data-callback-url') || window.location.href;
  const width = script.getAttribute('data-width') || '100%';
  const requestedHeight = script.getAttribute('data-height') || '640';
  const minHeight = Number(script.getAttribute('data-min-height') || '420');
  const autoRedirect = script.getAttribute('data-auto-redirect');
  const containerSelector = script.getAttribute('data-container');
  const contactToken = script.getAttribute('data-contact-token');
  const contactEmail = script.getAttribute('data-contact-email');
  const contactName = script.getAttribute('data-contact-name');

  let container = null;
  if (containerSelector) {
    container = document.querySelector(containerSelector);
  }

  if (!container) {
    container = document.createElement('div');
    script.parentNode?.insertBefore(container, script.nextSibling);
  }

  const frame = document.createElement('iframe');
  const widgetUrl = new URL(\`\${apiBase}/public/forms/\${encodeURIComponent(bootstrap.slug)}/widget\`);
  if (callbackUrl) {
    widgetUrl.searchParams.set('callback_url', callbackUrl);
  }
  if (contactToken) {
    widgetUrl.searchParams.set('contact_token', contactToken);
  }
  if (contactEmail) {
    widgetUrl.searchParams.set('contact_email', contactEmail);
  }
  if (contactName) {
    widgetUrl.searchParams.set('contact_name', contactName);
  }
  if (autoRedirect) {
    widgetUrl.searchParams.set('auto_redirect', autoRedirect);
  }

  frame.src = widgetUrl.toString();
  frame.loading = 'lazy';
  frame.style.width = width;
  frame.style.border = '0';
  frame.style.display = 'block';
  frame.style.maxWidth = '100%';
  frame.style.height = /^\\d+$/.test(requestedHeight) ? \`\${requestedHeight}px\` : requestedHeight;
  frame.setAttribute('allow', 'payment *');
  frame.setAttribute('referrerpolicy', 'origin');
  frame.title = script.getAttribute('data-title') || 'Payforms widget';

  container.innerHTML = '';
  container.appendChild(frame);

  const trustedOrigin = new URL(apiBase).origin;
  window.addEventListener('message', event => {
    if (event.origin !== trustedOrigin) {
      return;
    }

    const data = event.data || {};
    if (data.source !== 'payforms-widget' || data.slug !== bootstrap.slug) {
      return;
    }

    if (data.event === 'resize' && data.payload && typeof data.payload.height === 'number') {
      const nextHeight = Math.max(minHeight, data.payload.height);
      frame.style.height = \`\${nextHeight}px\`;
    }

    window.dispatchEvent(new CustomEvent('payforms-widget-event', { detail: data }));
  });
})();`;
  }

  private buildWidgetHtml(params: {
    slug: string;
    baseUrl: string;
    callbackUrl?: string;
    contactToken?: string;
    contactEmail?: string;
    contactName?: string;
    autoRedirect: boolean;
  }): string {
    const bootstrap = JSON.stringify({
      slug: params.slug,
      apiBaseUrl: params.baseUrl,
      callbackUrl: params.callbackUrl || '',
      contactToken: params.contactToken || '',
      contactEmail: params.contactEmail || '',
      contactName: params.contactName || '',
      autoRedirect: params.autoRedirect,
    });

    return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Payforms Widget</title>
    <style>
      :root {
        color-scheme: light;
        --pf-bg: #f4f7fb;
        --pf-card: #ffffff;
        --pf-text: #102037;
        --pf-muted: #5f6f84;
        --pf-border: #d8e0eb;
        --pf-primary: #0f6ef0;
        --pf-primary-hover: #0c58c0;
        --pf-danger: #b42318;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Avenir Next", "Nunito Sans", "Trebuchet MS", sans-serif;
        background: var(--pf-bg);
        color: var(--pf-text);
      }
      .shell {
        max-width: 760px;
        margin: 0 auto;
        padding: 16px;
      }
      .card {
        background: var(--pf-card);
        border: 1px solid var(--pf-border);
        border-radius: 14px;
        padding: 20px;
      }
      h1 {
        margin: 0;
        font-size: 1.3rem;
      }
      .meta {
        margin-top: 4px;
        color: var(--pf-muted);
        font-size: 0.92rem;
      }
      .status {
        margin-top: 12px;
        min-height: 24px;
        color: var(--pf-muted);
      }
      .status.error {
        color: var(--pf-danger);
      }
      .status.success {
        color: var(--pf-primary);
      }
      form {
        display: grid;
        gap: 12px;
        margin-top: 16px;
      }
      label {
        display: grid;
        gap: 6px;
        font-size: 0.92rem;
        font-weight: 600;
      }
      input,
      select,
      textarea,
      button {
        font: inherit;
      }
      input,
      select,
      textarea {
        width: 100%;
        border: 1px solid var(--pf-border);
        border-radius: 10px;
        padding: 10px 12px;
        color: var(--pf-text);
        background: #fff;
      }
      textarea {
        min-height: 110px;
        resize: vertical;
      }
      button {
        border: 0;
        border-radius: 10px;
        padding: 11px 16px;
        background: var(--pf-primary);
        color: #fff;
        cursor: pointer;
        font-weight: 600;
      }
      button:hover {
        background: var(--pf-primary-hover);
      }
      button:disabled {
        cursor: not-allowed;
        opacity: 0.7;
      }
      .required {
        color: #9f1239;
        margin-left: 4px;
      }
      .pay-link {
        margin-top: 10px;
        display: inline-block;
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="card">
        <h1 id="title">Loading form...</h1>
        <p id="meta" class="meta"></p>
        <p id="status" class="status">Preparing widget...</p>
        <div id="form-root"></div>
      </section>
    </main>
    <script>
      (() => {
        const config = ${bootstrap};
        const titleEl = document.getElementById('title');
        const metaEl = document.getElementById('meta');
        const statusEl = document.getElementById('status');
        const rootEl = document.getElementById('form-root');
        const state = { form: null };

        const emit = (event, payload = {}) => {
          if (window.parent && window.parent !== window) {
            window.parent.postMessage({
              source: 'payforms-widget',
              slug: config.slug,
              event,
              payload,
            }, '*');
          }
        };

        const emitResize = () => {
          emit('resize', {
            height: Math.ceil(document.documentElement.scrollHeight),
          });
        };

        const setStatus = (message, type = 'info') => {
          statusEl.textContent = message || '';
          statusEl.className = 'status';
          if (type === 'error') {
            statusEl.classList.add('error');
          }
          if (type === 'success') {
            statusEl.classList.add('success');
          }
          emitResize();
        };

        const buildHeaders = (json = false) => {
          const headers = {};
          if (json) {
            headers['Content-Type'] = 'application/json';
          }
          if (config.contactToken) {
            headers['Authorization'] = 'Bearer ' + config.contactToken;
          }
          return headers;
        };

        const readErrorMessage = (payload) => {
          if (!payload) {
            return 'Request failed.';
          }
          if (typeof payload.message === 'string') {
            return payload.message;
          }
          if (Array.isArray(payload.message)) {
            return payload.message.join(', ');
          }
          if (payload.error) {
            return payload.error;
          }
          return 'Request failed.';
        };

        const createInputByType = field => {
          if (field.type === 'TEXTAREA') {
            const textarea = document.createElement('textarea');
            textarea.name = field.label;
            textarea.required = !!field.required;
            return textarea;
          }

          if (field.type === 'SELECT') {
            const select = document.createElement('select');
            select.name = field.label;
            select.required = !!field.required;
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'Select an option';
            placeholder.disabled = !!field.required;
            placeholder.selected = true;
            select.appendChild(placeholder);

            for (const option of field.options || []) {
              const item = document.createElement('option');
              item.value = option;
              item.textContent = option;
              select.appendChild(item);
            }
            return select;
          }

          const input = document.createElement('input');
          input.name = field.label;
          input.required = !!field.required;
          if (field.type === 'EMAIL') {
            input.type = 'email';
          } else if (field.type === 'NUMBER') {
            input.type = 'number';
          } else {
            input.type = 'text';
          }
          return input;
        };

        const toAmountLabel = amount => {
          if (amount === null || amount === undefined || amount === '') {
            return '';
          }
          const numeric = Number(amount);
          if (Number.isNaN(numeric)) {
            return String(amount);
          }
          return new Intl.NumberFormat('en-NG', {
            style: 'currency',
            currency: 'NGN',
            minimumFractionDigits: 2,
          }).format(numeric);
        };

        const renderForm = form => {
          rootEl.innerHTML = '';
          const formEl = document.createElement('form');
          const fieldInputs = new Map();

          const contactEmail = document.createElement('input');
          contactEmail.type = 'email';
          contactEmail.name = 'contact_email';
          contactEmail.placeholder = 'Email for payment receipt (optional)';
          contactEmail.value = config.contactEmail || '';

          const contactEmailLabel = document.createElement('label');
          contactEmailLabel.textContent = 'Contact Email';
          contactEmailLabel.appendChild(contactEmail);
          formEl.appendChild(contactEmailLabel);

          const contactName = document.createElement('input');
          contactName.type = 'text';
          contactName.name = 'contact_name';
          contactName.placeholder = 'Name (optional)';
          contactName.value = config.contactName || '';

          const contactNameLabel = document.createElement('label');
          contactNameLabel.textContent = 'Contact Name';
          contactNameLabel.appendChild(contactName);
          formEl.appendChild(contactNameLabel);

          for (const field of form.fields || []) {
            const wrapper = document.createElement('label');
            wrapper.textContent = field.label;
            if (field.required) {
              const required = document.createElement('span');
              required.className = 'required';
              required.textContent = '*';
              wrapper.appendChild(required);
            }
            const input = createInputByType(field);
            wrapper.appendChild(input);
            fieldInputs.set(field.label, input);
            formEl.appendChild(wrapper);
          }

          let amountInput = null;
          if (form.payment_type === 'VARIABLE') {
            const variableLabel = document.createElement('label');
            variableLabel.textContent = 'Amount';
            const required = document.createElement('span');
            required.className = 'required';
            required.textContent = '*';
            variableLabel.appendChild(required);
            amountInput = document.createElement('input');
            amountInput.type = 'number';
            amountInput.step = '0.01';
            amountInput.min = '0';
            amountInput.required = true;
            amountInput.placeholder = 'Enter amount';
            variableLabel.appendChild(amountInput);
            formEl.appendChild(variableLabel);
          }

          const submitButton = document.createElement('button');
          submitButton.type = 'submit';
          submitButton.textContent = 'Proceed to Payment';
          formEl.appendChild(submitButton);

          formEl.addEventListener('submit', async event => {
            event.preventDefault();
            submitButton.disabled = true;
            setStatus('Creating payment...', 'info');

            const payload = { data: {} };

            for (const field of form.fields || []) {
              const el = fieldInputs.get(field.label);
              if (!el) {
                continue;
              }
              payload.data[field.label] = el.value;
            }

            if (amountInput) {
              payload.data.amount = Number(amountInput.value);
            }

            if (contactEmail.value.trim()) {
              payload.contact_email = contactEmail.value.trim();
            }
            if (contactName.value.trim()) {
              payload.contact_name = contactName.value.trim();
            }

            const submitUrl = new URL(config.apiBaseUrl + '/public/forms/' + encodeURIComponent(config.slug) + '/submit');
            if (config.callbackUrl) {
              submitUrl.searchParams.set('callback_url', config.callbackUrl);
            }

            try {
              const response = await fetch(submitUrl.toString(), {
                method: 'POST',
                headers: buildHeaders(true),
                body: JSON.stringify(payload),
              });

              const result = await response.json().catch(() => ({}));
              if (!response.ok) {
                throw new Error(readErrorMessage(result));
              }

              emit('submitted', {
                submission_id: result.submission && result.submission.id,
                payment_reference: result.payment && result.payment.reference,
              });

              const authUrl = result.authorization && result.authorization.authorization_url;
              if (!authUrl) {
                setStatus('Submission saved, but payment URL is missing.', 'error');
                submitButton.disabled = false;
                return;
              }

              emit('payment_initialized', {
                payment_reference: result.payment && result.payment.reference,
                authorization_url: authUrl,
              });

              if (config.autoRedirect) {
                setStatus('Redirecting to payment...', 'success');
                window.top.location.href = authUrl;
                return;
              }

              setStatus('Payment initialized. Click the link below to continue.', 'success');
              const payLink = document.createElement('a');
              payLink.href = authUrl;
              payLink.target = '_top';
              payLink.rel = 'noopener noreferrer';
              payLink.className = 'pay-link';
              payLink.textContent = 'Continue to payment';
              rootEl.appendChild(payLink);
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unable to initialize payment.';
              setStatus(message, 'error');
              emit('error', { message });
              submitButton.disabled = false;
            }
          });

          rootEl.appendChild(formEl);
          emitResize();
        };

        const initialize = async () => {
          const formUrl = config.apiBaseUrl + '/public/forms/' + encodeURIComponent(config.slug);
          try {
            const response = await fetch(formUrl, {
              headers: buildHeaders(false),
            });
            const payload = await response.json().catch(() => ({}));

            if (!response.ok) {
              throw new Error(readErrorMessage(payload));
            }

            state.form = payload;
            titleEl.textContent = payload.title || 'Payment Form';
            const amountLabel = payload.payment_type === 'FIXED' ? toAmountLabel(payload.amount) : 'Variable amount';
            metaEl.textContent = amountLabel ? ('Payment type: ' + payload.payment_type + ' | ' + amountLabel) : ('Payment type: ' + payload.payment_type);
            setStatus('Fill the form to continue to payment.');
            renderForm(payload);
            emit('ready', {
              form_id: payload.id,
              title: payload.title,
              payment_type: payload.payment_type,
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unable to load form.';
            setStatus(message, 'error');
            emit('error', { message });
          }
        };

        if (typeof ResizeObserver !== 'undefined') {
          const observer = new ResizeObserver(() => emitResize());
          observer.observe(document.body);
        }
        window.addEventListener('load', emitResize);
        initialize().finally(() => setTimeout(emitResize, 100));
      })();
    </script>
  </body>
</html>`;
  }
}
