import { BadRequestException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PublicController } from './public.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockFormService = ReturnType<typeof mockFormService>;
type MockSubmissionService = ReturnType<typeof mockSubmissionService>;
type MockPaymentService = ReturnType<typeof mockPaymentService>;
type MockContactService = ReturnType<typeof mockContactService>;
type MockNotificationService = ReturnType<typeof mockNotificationService>;
type MockConfigService = ReturnType<typeof mockConfigService>;
type MockJwtService = ReturnType<typeof mockJwtService>;

const mockFormService = () => ({
  findBySlug: jest.fn(),
  isContactEligible: jest.fn(),
});

const mockSubmissionService = () => ({
  create: jest.fn(),
});

const mockPaymentService = () => ({
  create: jest.fn(),
  initializePaystack: jest.fn(),
  markInitializationFailed: jest.fn(),
  findByReferenceGlobal: jest.fn(),
  verifyAndFinalizePayment: jest.fn(),
});

const mockContactService = () => ({
  findByEmail: jest.fn(),
  findByExternalId: jest.fn(),
  createFromPublic: jest.fn(),
});

const mockNotificationService = () => ({
  sendSubmissionConfirmation: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

const mockJwtService = () => ({
  verify: jest.fn(),
});

describe('PublicController', () => {
  let controller: PublicController;
  let formService: MockFormService;
  let submissionService: MockSubmissionService;
  let paymentService: MockPaymentService;
  let contactService: MockContactService;
  let notificationService: MockNotificationService;
  let configService: MockConfigService;
  let jwtService: MockJwtService;

  beforeEach(() => {
    formService = mockFormService();
    submissionService = mockSubmissionService();
    paymentService = mockPaymentService();
    contactService = mockContactService();
    notificationService = mockNotificationService();
    configService = mockConfigService();
    jwtService = mockJwtService();

    controller = new PublicController(
      formService as any,
      submissionService as any,
      paymentService as any,
      contactService as any,
      notificationService as any,
      configService as any,
      jwtService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns public form data when form exists and no targets required', async () => {
    const form = { id: 'form-1', title: 'Test', category: 'Cat', slug: 'test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [] };
    formService.findBySlug.mockResolvedValue(form);

    const result = await controller.getPublicForm('test', undefined);

    expect(result).toEqual({
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      description: undefined,
      note: undefined,
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      access_mode: 'OPEN',
      identity_validation_mode: 'NONE',
      identity_field_label: null,
      fields: [],
    });
  });

  it('includes access_mode in public form payload', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      access_mode: 'LOGIN_REQUIRED',
    };
    formService.findBySlug.mockResolvedValue(form as any);
    jwtService.verify.mockReturnValue({ sub: 'contact-1', role: 'CONTACT' });

    const result = await controller.getPublicForm('test', 'Bearer valid-token');

    expect(result.access_mode).toBe('LOGIN_REQUIRED');
  });

  it('throws NotFoundException when public form is missing', async () => {
    formService.findBySlug.mockResolvedValue(null);

    await expect(controller.getPublicForm('missing', undefined)).rejects.toThrow(NotFoundException);
  });

  it('rejects submit when identity validation mode is CONTACT_EMAIL and email is missing', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      identity_validation_mode: 'CONTACT_EMAIL',
      identity_field_label: null,
    } as any;
    const dto = { data: { name: 'Jane Doe' } };

    formService.findBySlug.mockResolvedValue(form);

    await expect(controller.submitPublicForm('test', dto as any, 'https://callback', undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejects submit when identity validation mode is CONTACT_EMAIL and email is not registered', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      identity_validation_mode: 'CONTACT_EMAIL',
      identity_field_label: null,
    } as any;
    const dto = { data: { name: 'Jane Doe' }, contact_email: 'jane@example.com' };

    formService.findBySlug.mockResolvedValue(form);
    contactService.findByEmail.mockResolvedValue(null);

    await expect(controller.submitPublicForm('test', dto as any, 'https://callback', undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejects submit when identity validation mode is CONTACT_EXTERNAL_ID and external ID field is missing', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      identity_validation_mode: 'CONTACT_EXTERNAL_ID',
      identity_field_label: 'student_id',
    } as any;
    const dto = { data: { name: 'Jane Doe' } };

    formService.findBySlug.mockResolvedValue(form);

    await expect(controller.submitPublicForm('test', dto as any, 'https://callback', undefined)).rejects.toThrow(BadRequestException);
  });

  it('rejects submit when identity validation mode is CONTACT_EXTERNAL_ID and external ID is invalid', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      identity_validation_mode: 'CONTACT_EXTERNAL_ID',
      identity_field_label: 'student_id',
    } as any;
    const dto = { data: { student_id: 'EXT123' } };

    formService.findBySlug.mockResolvedValue(form);
    contactService.findByExternalId.mockResolvedValue(null);

    await expect(controller.submitPublicForm('test', dto as any, 'https://callback', undefined)).rejects.toThrow(BadRequestException);
  });

  it('returns widget config for public form', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
    };
    formService.findBySlug.mockResolvedValue(form);

    const req = {
      protocol: 'https',
      headers: {
        host: 'api.payforms.test',
      },
      get: (header: string) => (header.toLowerCase() === 'host' ? 'api.payforms.test' : undefined),
    };

    const result = await controller.getWidgetConfig('test', req as any, undefined);

    expect(result.form).toEqual({
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      description: undefined,
      note: undefined,
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      access_mode: 'OPEN',
      identity_validation_mode: 'NONE',
      identity_field_label: null,
      is_targeted: false,
      fields: [],
    });
    expect(result.endpoints.widget).toBe('https://api.payforms.test/public/forms/test/widget');
    expect(result.endpoints.embed_script).toBe('https://api.payforms.test/public/forms/test/embed.js');
    expect(result.embed_code).toContain('data-payforms-widget');
  });

  it('returns embed script when form exists', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
    };
    formService.findBySlug.mockResolvedValue(form);

    const req = {
      protocol: 'http',
      headers: { host: 'localhost:3001' },
      get: () => 'localhost:3001',
    };

    const script = await controller.getEmbedScript('test', req as any);
    expect(script).toContain('payforms-widget-event');
    expect(script).toContain('/public/forms/');
    expect(script).toContain('test');
  });

  it('returns widget html when form exists', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
    };
    formService.findBySlug.mockResolvedValue(form);

    const req = {
      protocol: 'http',
      headers: { host: 'localhost:3001' },
      get: () => 'localhost:3001',
    };

    const html = await controller.getWidgetHtml(
      'test',
      req as any,
      'https://site.example/callback',
      'contact-token',
      'john@example.com',
      'John',
      'false',
    );

    expect(html).toContain('<!doctype html>');
    expect(html).toContain('id="form-root"');
    expect(html).toContain('contact-token');
    expect(html).toContain('/public/forms/');
    expect(html).toContain('https://site.example/callback');
  });

  it('throws UnauthorizedException for targeted form without auth', async () => {
    const form = { id: 'form-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [{}] };
    formService.findBySlug.mockResolvedValue(form);
    jwtService.verify.mockImplementation(() => { throw new Error('invalid'); });

    await expect(controller.getPublicForm('test', undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for org-wide require_contact_login on public form access', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      organization: { require_contact_login: true },
      identity_validation_mode: 'NONE',
      identity_field_label: null,
    } as any;
    formService.findBySlug.mockResolvedValue(form);

    await expect(controller.getPublicForm('test', undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for org-wide require_contact_login on widget config access', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      category: 'Cat',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      organization: { require_contact_login: true },
      identity_validation_mode: 'NONE',
      identity_field_label: null,
    } as any;
    formService.findBySlug.mockResolvedValue(form);

    const req = {
      protocol: 'https',
      headers: { host: 'api.payforms.test' },
      get: (header: string) => (header.toLowerCase() === 'host' ? 'api.payforms.test' : undefined),
    } as any;

    await expect(controller.getWidgetConfig('test', req, undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for login_required form access without auth', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      access_mode: 'LOGIN_REQUIRED',
    } as any;
    formService.findBySlug.mockResolvedValue(form);
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(controller.getPublicForm('test', undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('allows login_required form access with valid contact token', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      access_mode: 'LOGIN_REQUIRED',
    } as any;
    formService.findBySlug.mockResolvedValue(form);
    jwtService.verify.mockReturnValue({ sub: 'contact-1', role: 'CONTACT' });

    const result = await controller.getPublicForm('test', 'Bearer valid-token');

    expect(result).toEqual({
      id: 'form-1',
      title: 'Test',
      category: undefined,
      description: undefined,
      note: undefined,
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      access_mode: 'LOGIN_REQUIRED',
      identity_validation_mode: 'NONE',
      identity_field_label: null,
      fields: [],
    });
  });

  it('throws UnauthorizedException for targeted_only form access without auth', async () => {
    const form = {
      id: 'form-1',
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      access_mode: 'TARGETED_ONLY',
    } as any;
    formService.findBySlug.mockResolvedValue(form);
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid');
    });

    await expect(controller.getPublicForm('test', undefined)).rejects.toThrow(UnauthorizedException);
  });

  it('submits public form for fixed payment and sends confirmation email when enabled', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test',
      payment_type: 'FIXED',
      amount: 100,
      allow_partial: false,
      fields: [],
      targets: [],
      organization: { notify_submission_confirmation: true },
    } as any;
    const dto = { data: { name: 'Jane Doe' }, contact_email: 'jane@example.com' };
    const submission = { id: 'submission-1' };
    const payment = { id: 'payment-1', reference: 'ref-1', amount: 100 };
    const authorization = { authorization_url: 'https://paystack' };

    formService.findBySlug.mockResolvedValue(form);
    contactService.findByEmail.mockResolvedValue({ id: 'contact-1' });
    submissionService.create.mockResolvedValue(submission);
    paymentService.create.mockResolvedValue(payment);
    configService.get.mockReturnValue('https://callback');
    paymentService.initializePaystack.mockResolvedValue(authorization);
    notificationService.sendSubmissionConfirmation.mockResolvedValue(undefined);

    const result = await controller.submitPublicForm('test', dto as any, 'https://callback', undefined);

    expect(result).toEqual({ submission, payment, authorization });
    expect(notificationService.sendSubmissionConfirmation).toHaveBeenCalledWith(
      form.organization,
      'jane@example.com',
      'Test',
      100,
      'ref-1',
    );
  });

  it('creates a public contact when email not found', async () => {
    const form = { id: 'form-1', organization_id: 'org-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [], organization: { notify_submission_confirmation: false } } as any;
    const dto = { data: { name: 'Jane Doe' }, contact_email: 'jane@example.com', contact_name: 'Jane' };
    const submission = { id: 'submission-1' };
    const payment = { id: 'payment-1', reference: 'ref-1', amount: 100 };
    const authorization = { authorization_url: 'https://paystack' };

    formService.findBySlug.mockResolvedValue(form);
    contactService.findByEmail.mockResolvedValue(null);
    contactService.createFromPublic.mockResolvedValue({ id: 'contact-1' });
    submissionService.create.mockResolvedValue(submission);
    paymentService.create.mockResolvedValue(payment);
    configService.get.mockReturnValue('https://callback');
    paymentService.initializePaystack.mockResolvedValue(authorization);

    const result = await controller.submitPublicForm('test', dto as any, 'https://callback', undefined);

    expect(contactService.createFromPublic).toHaveBeenCalledWith('org-1', 'Jane', 'Doe', 'jane@example.com');
    expect(result).toEqual({ submission, payment, authorization });
  });

  it('throws BadRequestException if callback URL is missing', async () => {
    const form = { id: 'form-1', organization_id: 'org-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [], organization: { notify_submission_confirmation: false } } as any;
    const dto = { data: { name: 'Jane Doe' } };

    formService.findBySlug.mockResolvedValue(form);
    submissionService.create.mockResolvedValue({ id: 'submission-1' });
    paymentService.create.mockResolvedValue({ id: 'payment-1' });
    configService.get.mockReturnValue(null);

    await expect(controller.submitPublicForm('test', dto as any, undefined, undefined)).rejects.toThrow(BadRequestException);
  });

  it('marks payment as failed when paystack initialization fails', async () => {
    const form = { id: 'form-1', organization_id: 'org-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [], organization: { notify_submission_confirmation: false } } as any;
    const dto = { data: { name: 'Jane Doe' }, contact_email: 'jane@example.com' };
    const submission = { id: 'submission-1' };
    const payment = { id: 'payment-1', reference: 'ref-1', amount: 100 };

    formService.findBySlug.mockResolvedValue(form);
    contactService.findByEmail.mockResolvedValue({ id: 'contact-1' });
    submissionService.create.mockResolvedValue(submission);
    paymentService.create.mockResolvedValue(payment);
    paymentService.initializePaystack.mockRejectedValue(new BadRequestException('Failed to initialize payment'));
    paymentService.markInitializationFailed.mockResolvedValue({ ...payment, status: 'FAILED' });

    await expect(
      controller.submitPublicForm('test', dto as any, 'https://callback', undefined),
    ).rejects.toThrow(BadRequestException);

    expect(paymentService.markInitializationFailed).toHaveBeenCalledWith(
      'org-1',
      'payment-1',
      'Failed to initialize payment',
    );
  });

  it('returns ignored callback response when payment reference is unknown', async () => {
    paymentService.findByReferenceGlobal.mockResolvedValue(null);

    const result = await controller.handlePaymentCallback('ref-1', undefined);

    expect(result).toEqual({
      status: 'ignored',
      reason: 'payment_not_found',
      reference: 'ref-1',
    });
  });

  it('processes callback response when payment reference is found', async () => {
    paymentService.findByReferenceGlobal.mockResolvedValue({
      id: 'payment-1',
      organization_id: 'org-1',
      reference: 'ref-1',
    });
    paymentService.verifyAndFinalizePayment.mockResolvedValue({
      success: true,
      skipped: false,
      payment: { id: 'payment-1', status: 'PAID' },
      verified: { status: 'success' },
    });

    const result = await controller.handlePaymentCallback('ref-1', undefined);

    expect(paymentService.verifyAndFinalizePayment).toHaveBeenCalledWith(
      'org-1',
      'ref-1',
      'callback_redirect',
    );
    expect(result).toEqual({
      status: 'processed',
      reference: 'ref-1',
      skipped: false,
      payment: { id: 'payment-1', status: 'PAID' },
      verified: { status: 'success' },
    });
  });

  it('validates required submission field and throws BadRequestException', async () => {
    const form = { id: 'form-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [{ label: 'name', required: true, type: 'TEXT' }], targets: [] } as any;
    const dto = { data: {} };

    formService.findBySlug.mockResolvedValue(form);

    await expect(controller.submitPublicForm('test', dto as any, 'https://callback', undefined)).rejects.toThrow(BadRequestException);
  });

  it('allows targeted form access with valid contact token and eligibility', async () => {
    const form = { id: 'form-1', title: 'Test', payment_type: 'FIXED', amount: 100, allow_partial: false, fields: [], targets: [{}] } as any;
    const dto = { data: { name: 'Jane' } };
    const submission = { id: 'submission-1' };
    const payment = { id: 'payment-1', reference: 'ref-1', amount: 100 };
    const authorization = { authorization_url: 'https://paystack' };

    formService.findBySlug.mockResolvedValue(form);
    jwtService.verify.mockReturnValue({ sub: 'contact-1', role: 'CONTACT' });
    formService.isContactEligible.mockResolvedValue(true);
    submissionService.create.mockResolvedValue(submission);
    paymentService.create.mockResolvedValue(payment);
    configService.get.mockReturnValue('https://callback');
    paymentService.initializePaystack.mockResolvedValue(authorization);

    const result = await controller.submitPublicForm('test', dto as any, 'https://callback', 'Bearer valid-token');

    expect(formService.isContactEligible).toHaveBeenCalledWith(form, 'contact-1');
    expect(result).toEqual({ submission, payment, authorization });
  });
});
