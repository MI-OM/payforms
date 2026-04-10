import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { Payment, PaymentMethod } from '../entities/payment.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { PaymentLog } from '../../audit/entities/payment-log.entity';
import { Submission } from '../../submission/entities/submission.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { Form } from '../../form/entities/form.entity';
import { NotificationService } from '../../notification/notification.service';
import { CreatePaymentDto, UpdatePaymentStatusDto } from '../dto/payment.dto';
import { User } from '../../auth/entities/user.entity';

type TransactionFilters = {
  status?: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
  reference?: string;
  form_id?: string;
  contact_id?: string;
  payment_method?: PaymentMethod;
  start_date?: string;
  end_date?: string;
};

@Injectable()
export class PaymentService {
  constructor(
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(PaymentLog)
    private paymentLogRepository: Repository<PaymentLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async create(organizationId: string, dto: CreatePaymentDto) {
    const reference = dto.reference || `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (org?.partial_payment_limit && Number(dto.amount) < Number(org.partial_payment_limit)) {
      throw new BadRequestException(`Payment total must be at least ${org.partial_payment_limit}`);
    }

    const totalAmount = dto.total_amount || dto.amount;
    const balanceDue = dto.total_amount ? dto.total_amount : dto.amount; // For partial payments, balance_due starts as total_amount, for full payments as amount

    const payment = this.paymentRepository.create({
      organization_id: organizationId,
      submission_id: dto.submission_id,
      amount: dto.amount,
      total_amount: dto.total_amount || null,
      amount_paid: 0,
      balance_due: balanceDue,
      reference,
      status: 'PENDING',
      payment_method: dto.payment_method || 'ONLINE',
    });
    return this.paymentRepository.save(payment);
  }

  async findByOrganization(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.paymentRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, page, limit };
  }

  async findById(organizationId: string, id: string) {
    return this.paymentRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['submission'],
    });
  }

  async findByReference(organizationId: string, reference: string) {
    return this.paymentRepository.findOne({
      where: { reference, organization_id: organizationId },
      relations: ['submission'],
    });
  }

  async findTransactions(
    organizationId: string,
    filters: TransactionFilters,
    page: number = 1,
    limit: number = 20,
  ) {
    const qb = this.buildTransactionsQuery(organizationId, filters);

    const [data, total] = await qb
      .orderBy('payment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async listPendingOfflinePayments(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.paymentRepository.findAndCount({
      where: {
        organization_id: organizationId,
        status: 'PENDING',
        payment_method: Not('ONLINE' as PaymentMethod),
      },
      relations: ['submission', 'submission.contact'],
      order: { created_at: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async exportTransactions(organizationId: string, filters: TransactionFilters) {
    const rows = await this.buildTransactionsQuery(organizationId, filters)
      .leftJoin(Form, 'form', 'form.id = submission.form_id')
      .leftJoin(Contact, 'contact', 'contact.id = submission.contact_id')
      .select([
        'payment.reference AS reference',
        'payment.amount AS amount',
        'payment.payment_method AS payment_method',
        'payment.status AS status',
        'payment.paid_at AS paid_at',
        'payment.created_at AS created_at',
        'form.title AS form_name',
        'contact.first_name AS contact_first_name',
        'contact.middle_name AS contact_middle_name',
        'contact.last_name AS contact_last_name',
        'contact.email AS contact_email',
      ])
      .orderBy('payment.created_at', 'DESC')
      .getRawMany();

    return this.buildTransactionsCsv(rows);
  }

  async exportByOrganization(organizationId: string) {
    const payments = await this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .orderBy('payment.created_at', 'DESC')
      .getMany();

    return this.buildPaymentsCsv(payments);
  }

  async generateContactReceiptByPaymentId(organizationId: string, contactId: string, paymentId: string) {
    return this.generateContactReceipt(organizationId, contactId, { paymentId });
  }

  async generateContactReceiptByReference(organizationId: string, contactId: string, reference: string) {
    return this.generateContactReceipt(organizationId, contactId, { reference });
  }

  async generateOrganizationReceiptByPaymentId(organizationId: string, paymentId: string) {
    return this.generateOrganizationReceipt(organizationId, { paymentId });
  }

  async generateOrganizationReceiptByReference(organizationId: string, reference: string) {
    return this.generateOrganizationReceipt(organizationId, { reference });
  }

  async getTransactionHistory(
    organizationId: string,
    paymentId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const payment = await this.findById(organizationId, paymentId);
    if (!payment) {
      throw new NotFoundException('Transaction not found');
    }

    const [data, total] = await this.paymentLogRepository.findAndCount({
      where: { payment_id: paymentId, organization_id: organizationId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  async findByReferenceGlobal(reference: string) {
    return this.paymentRepository.findOne({
      where: { reference },
    });
  }

  async validatePaystackWebhookSignature(rawBody: string, signature: string) {
    const organizations = await this.organizationRepository.find({
      where: { paystack_secret_key: Not(IsNull()) },
    });

    for (const org of organizations) {
      const expected = crypto.createHmac('sha512', org.paystack_secret_key).update(rawBody).digest('hex');
      if (expected === signature) {
        return org.id;
      }
    }

    return null;
  }

  async updateStatus(
    organizationId: string,
    id: string,
    dto: UpdatePaymentStatusDto,
    options: {
      actorUserId?: string;
      source?: 'admin_update' | 'paystack' | 'system';
      offlineReviewOnly?: boolean;
    } = {},
  ) {
    const payment = await this.findById(organizationId, id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const nextPaymentMethod = dto.payment_method ?? payment.payment_method;
    const isOfflinePayment = nextPaymentMethod !== 'ONLINE';

    if (options.offlineReviewOnly && !isOfflinePayment) {
      throw new BadRequestException('Offline review is available only for offline payments');
    }

    let amount_paid = payment.amount_paid ?? 0;
    const totalAmount = payment.total_amount ?? payment.amount;
    let balance_due = totalAmount - amount_paid;

    if (dto.status === 'PAID') {
      amount_paid = payment.amount; // Amount charged in this transaction
      balance_due = Math.max(totalAmount - (payment.amount_paid + payment.amount), 0);
    } else if (dto.status === 'PARTIAL') {
      if (dto.amount_paid !== undefined && dto.amount_paid !== null) {
        amount_paid = Math.min(dto.amount_paid, totalAmount);
      } else {
        amount_paid = payment.amount; // Assume the charged amount was paid
      }
      balance_due = Math.max(totalAmount - amount_paid, 0);
    } else if (dto.status === 'FAILED' || dto.status === 'PENDING') {
      // keep existing payment tracking values
      amount_paid = payment.amount_paid ?? 0;
      balance_due = payment.balance_due ?? totalAmount;
    }

    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (dto.status === 'PARTIAL' && org?.partial_payment_limit !== null && org?.partial_payment_limit !== undefined) {
      const partialLimit = Number(org.partial_payment_limit);
      if (amount_paid < partialLimit) {
        throw new BadRequestException(`Partial payment must be at least ${partialLimit}`);
      }
    }

    const confirmationMetadata = this.resolveConfirmationMetadata(payment, dto, {
      actorUserId: options.actorUserId,
      isOfflinePayment,
      source: options.source,
      nextStatus: dto.status,
    });

    const paidAt = dto.status === 'PAID' || dto.status === 'PARTIAL'
      ? (dto.paid_at ?? payment.paid_at ?? new Date())
      : null;

    await this.paymentRepository.update({ id, organization_id: organizationId }, {
      status: dto.status,
      payment_method: nextPaymentMethod,
      paid_at: paidAt,
      amount_paid,
      balance_due,
      confirmed_at: confirmationMetadata.confirmed_at,
      confirmed_by_user_id: confirmationMetadata.confirmed_by_user_id,
      confirmation_note: confirmationMetadata.confirmation_note,
      external_reference: confirmationMetadata.external_reference,
    });

    if (options.source === 'admin_update') {
      await this.paymentLogRepository.save(
        this.paymentLogRepository.create({
          organization_id: organizationId,
          payment_id: payment.id,
          event_id: `payment.admin_update:${payment.id}:${crypto.randomUUID()}`,
          event: this.resolveAdminUpdateEvent(dto.status, isOfflinePayment),
          payload: {
            previous_status: payment.status,
            next_status: dto.status,
            payment_method: nextPaymentMethod,
            actor_user_id: options.actorUserId || null,
            confirmation_note: confirmationMetadata.confirmation_note,
            external_reference: confirmationMetadata.external_reference,
            confirmed_at: confirmationMetadata.confirmed_at,
            confirmed_by_user_id: confirmationMetadata.confirmed_by_user_id,
          },
        }),
      );
    }

    return this.findById(organizationId, id);
  }

  async initializePaystack(organizationId: string, payment: Payment, callbackUrl: string, customerEmail?: string) {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org?.paystack_secret_key) {
      throw new BadRequestException('Paystack keys not configured');
    }

    if (!customerEmail && payment.submission_id) {
      const submission = await this.submissionRepository.findOne({
        where: { id: payment.submission_id, organization_id: organizationId },
      });
      if (submission?.contact_id) {
        const contact = await this.contactRepository.findOne({
          where: { id: submission.contact_id, organization_id: organizationId },
          select: ['email'],
        });
        customerEmail = contact?.email ?? undefined;
      }
    }

    if (!customerEmail) {
      throw new BadRequestException('Customer email is required for payment initialization');
    }

    const email = customerEmail;

    try {
      const response = await axios.post(
        'https://api.paystack.co/transaction/initialize',
        {
          email,
          amount: Math.round(payment.amount * 100), // Convert to kobo
          reference: payment.reference,
          callback_url: callbackUrl,
        },
        {
          headers: {
            Authorization: `Bearer ${org.paystack_secret_key}`,
            'Content-Type': 'application/json',
          },
        },
      );

      return response.data.data;
    } catch (error) {
      console.error('Paystack initialization error:', error);
      throw new BadRequestException('Failed to initialize payment');
    }
  }

  async verifyPaystack(organizationId: string, reference: string) {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org?.paystack_secret_key) {
      throw new BadRequestException('Paystack keys not configured');
    }

    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${reference}`,
        {
          headers: {
            Authorization: `Bearer ${org.paystack_secret_key}`,
          },
        },
      );

      return response.data.data;
    } catch (error) {
      console.error('Paystack verification error:', error);
      throw new BadRequestException('Failed to verify payment');
    }
  }

  async handleWebhookEvent(
    organizationId: string,
    event: string,
    data: any,
    eventId: string,
  ) {
    const reference = data?.reference;
    if (!reference) {
      return { success: true, skipped: true, reason: 'missing_reference' };
    }

    const payment = await this.paymentRepository.findOne({
      where: { reference, organization_id: organizationId },
      relations: ['submission'],
    });

    if (!payment) {
      return { success: true, skipped: true, reason: 'payment_not_found' };
    }

    return this.applyPaystackOutcome({
      organizationId,
      payment,
      event,
      eventId,
      paystackData: data,
    });
  }

  async verifyAndFinalizePayment(
    organizationId: string,
    reference: string,
    source: 'manual_verify' | 'callback_redirect' = 'manual_verify',
  ) {
    const payment = await this.paymentRepository.findOne({
      where: { reference, organization_id: organizationId },
      relations: ['submission'],
    });
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const verified = await this.verifyPaystack(organizationId, reference);
    const eventId = this.buildVerificationEventId(source, reference, verified?.id);
    const event = source === 'callback_redirect'
      ? 'paystack.callback.verify'
      : 'paystack.manual.verify';

    const result = await this.applyPaystackOutcome({
      organizationId,
      payment,
      event,
      eventId,
      paystackData: verified,
    });

    return {
      ...result,
      verified,
    };
  }

  isSuccessfulPaymentStatus(status?: string | null) {
    const normalized = (status || '').trim().toUpperCase();
    return normalized === 'PAID' || normalized === 'PARTIAL';
  }

  isFailedPaymentStatus(status?: string | null) {
    const normalized = (status || '').trim().toUpperCase();
    return normalized === 'FAILED';
  }

  async markInitializationFailed(
    organizationId: string,
    paymentId: string,
    reason: string,
    details?: Record<string, any>,
  ) {
    const payment = await this.findById(organizationId, paymentId);
    if (!payment) {
      return null;
    }

    const eventId = `payment.initialize.failed:${payment.reference}`;
    const existingLog = await this.paymentLogRepository.findOne({
      where: { payment_id: payment.id, event_id: eventId },
    });

    if (!existingLog) {
      await this.paymentLogRepository.save(
        this.paymentLogRepository.create({
          organization_id: organizationId,
          payment_id: payment.id,
          event_id: eventId,
          event: 'payment.initialize.failed',
          payload: {
            reference: payment.reference,
            reason,
            ...(details || {}),
          },
        }),
      );
    }

    if (payment.status !== 'FAILED') {
      return this.updateStatus(organizationId, payment.id, { status: 'FAILED' });
    }

    return payment;
  }

  private mapPaystackStatusToPaymentStatus(status: string): 'PAID' | 'FAILED' | 'PARTIAL' | 'PENDING' {
    if (!status) {
      return 'PENDING';
    }

    const normalized = status.toLowerCase();
    if (normalized === 'success' || normalized === 'paid') {
      return 'PAID';
    }
    if (
      normalized === 'failed'
      || normalized === 'abandoned'
      || normalized === 'reversed'
      || normalized === 'timeout'
      || normalized === 'cancelled'
      || normalized === 'canceled'
    ) {
      return 'FAILED';
    }
    if (normalized === 'partial') {
      return 'PARTIAL';
    }

    return 'PENDING';
  }

  private buildTransactionsQuery(organizationId: string, filters: TransactionFilters) {
    const qb = this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId });

    if (filters.status) {
      qb.andWhere('UPPER(payment.status) = :status', { status: this.normalizeTransactionStatus(filters.status) });
    }

    if (filters.reference) {
      qb.andWhere('payment.reference ILIKE :reference', { reference: `%${filters.reference}%` });
    }

    if (filters.form_id) {
      qb.andWhere('submission.form_id = :form_id', { form_id: filters.form_id });
    }

    if (filters.contact_id) {
      qb.andWhere('submission.contact_id = :contact_id', { contact_id: filters.contact_id });
    }

    if (filters.payment_method) {
      qb.andWhere('payment.payment_method = :payment_method', { payment_method: filters.payment_method });
    }

    if (filters.start_date) {
      qb.andWhere('payment.created_at >= :start_date', { start_date: this.normalizeTransactionDate(filters.start_date, 'start') });
    }

    if (filters.end_date) {
      qb.andWhere('payment.created_at <= :end_date', { end_date: this.normalizeTransactionDate(filters.end_date, 'end') });
    }

    return qb;
  }

  private normalizeTransactionStatus(status: string) {
    return status.trim().toUpperCase();
  }

  private normalizeTransactionDate(value: string, boundary: 'start' | 'end') {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const normalizedValue = isDateOnly
      ? `${value}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
      : value;

    const parsed = new Date(normalizedValue);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${boundary === 'start' ? 'start_date' : 'end_date'}`);
    }

    return parsed;
  }

  private buildPaymentsCsv(payments: Payment[]) {
    const rows = payments.map(payment =>
      [
        payment.id,
        payment.reference,
        payment.amount,
        payment.payment_method,
        payment.status,
        payment.paid_at ? payment.paid_at.toISOString() : '',
        payment.created_at ? payment.created_at.toISOString() : '',
        payment.submission_id ?? '',
        payment.submission?.form_id ?? '',
        payment.submission?.contact_id ?? '',
      ].map(value => this.escapeCsv(value)).join(','),
    );

    return `id,reference,amount,payment_method,status,paid_at,created_at,submission_id,form_id,contact_id\n${rows.join('\n')}`;
  }

  private buildTransactionsCsv(rows: Array<{
    reference: string;
    amount: string | number;
    payment_method: string;
    status: string;
    paid_at: Date | string | null;
    created_at: Date | string | null;
    form_name: string | null;
    contact_first_name: string | null;
    contact_middle_name: string | null;
    contact_last_name: string | null;
    contact_email: string | null;
  }>) {
    const csvRows = rows.map(row => {
      const contactName = this.buildContactDisplayName({
        firstName: row.contact_first_name,
        middleName: row.contact_middle_name,
        lastName: row.contact_last_name,
        email: row.contact_email,
      });

      return [
        row.reference,
        row.amount,
        row.payment_method,
        row.status,
        row.paid_at ? new Date(row.paid_at).toISOString() : '',
        row.created_at ? new Date(row.created_at).toISOString() : '',
        row.form_name || 'N/A',
        contactName,
      ].map(value => this.escapeCsv(value)).join(',');
    });

    return `reference,amount,payment_method,status,paid_at,created_at,form_name,contact_name\n${csvRows.join('\n')}`;
  }

  private buildContactDisplayName(payload: {
    firstName?: string | null;
    middleName?: string | null;
    lastName?: string | null;
    email?: string | null;
  }) {
    const name = [payload.firstName, payload.middleName, payload.lastName]
      .map(value => value?.trim())
      .filter((value): value is string => !!value)
      .join(' ');

    return name || payload.email?.trim() || 'N/A';
  }

  private async generateContactReceipt(
    organizationId: string,
    contactId: string,
    lookup: { paymentId?: string; reference?: string },
  ) {
    const paymentQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('submission.contact_id = :contactId', { contactId });

    if (lookup.paymentId) {
      paymentQuery.andWhere('payment.id = :paymentId', { paymentId: lookup.paymentId });
    } else if (lookup.reference) {
      paymentQuery.andWhere('payment.reference = :reference', { reference: lookup.reference });
    } else {
      throw new BadRequestException('Payment lookup is required');
    }

    const payment = await paymentQuery.getOne();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    if (payment.status !== 'PAID' && payment.status !== 'PARTIAL') {
      throw new BadRequestException('Receipt is available only for paid or partial payments');
    }

    const [organization, contact, form] = await Promise.all([
      this.organizationRepository.findOne({
        where: { id: organizationId },
        select: ['id', 'name', 'email'],
      }),
      this.contactRepository.findOne({
        where: { id: contactId, organization_id: organizationId },
        select: ['id', 'first_name', 'last_name', 'email'],
      }),
      payment.submission?.form_id
        ? this.formRepository.findOne({
            where: { id: payment.submission.form_id, organization_id: organizationId },
            select: ['id', 'title'],
          })
        : Promise.resolve(null),
    ]);

    const confirmingUser = payment.confirmed_by_user_id
      ? await this.userRepository.findOne({
          where: { id: payment.confirmed_by_user_id, organization_id: organizationId },
          select: ['id', 'first_name', 'middle_name', 'last_name', 'email'],
        })
      : null;

    if (!organization || !contact) {
      throw new NotFoundException('Receipt owner not found');
    }

    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'N/A';

    const pdf = await this.buildReceiptPdf({
      organization,
      recipientName: contactName,
      recipientEmail: contact.email || 'N/A',
      payment,
      formName: form?.title || 'N/A',
      confirmedByName: this.buildUserDisplayName(confirmingUser),
    });

    const normalizedReference = String(payment.reference || payment.id).replace(/[^a-zA-Z0-9_-]+/g, '_');
    return {
      fileName: `receipt-${normalizedReference}.pdf`,
      content: pdf,
    };
  }

  private async generateOrganizationReceipt(
    organizationId: string,
    lookup: { paymentId?: string; reference?: string },
  ) {
    const paymentQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId });

    if (lookup.paymentId) {
      paymentQuery.andWhere('payment.id = :paymentId', { paymentId: lookup.paymentId });
    } else if (lookup.reference) {
      paymentQuery.andWhere('payment.reference = :reference', { reference: lookup.reference });
    } else {
      throw new BadRequestException('Payment lookup is required');
    }

    const payment = await paymentQuery.getOne();
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    const [organization, contact, form, confirmingUser] = await Promise.all([
      this.organizationRepository.findOne({ where: { id: organizationId }, select: ['id', 'name', 'email'] }),
      payment.submission?.contact_id
        ? this.contactRepository.findOne({
            where: { id: payment.submission.contact_id, organization_id: organizationId },
            select: ['id', 'first_name', 'last_name', 'email'],
          })
        : Promise.resolve(null),
      payment.submission?.form_id
        ? this.formRepository.findOne({
            where: { id: payment.submission.form_id, organization_id: organizationId },
            select: ['id', 'title'],
          })
        : Promise.resolve(null),
      payment.confirmed_by_user_id
        ? this.userRepository.findOne({
            where: { id: payment.confirmed_by_user_id, organization_id: organizationId },
            select: ['id', 'first_name', 'middle_name', 'last_name', 'email'],
          })
        : Promise.resolve(null),
    ]);

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const submissionData = payment.submission?.data || {};
    const recipientName = this.resolveReceiptRecipientName(contact, submissionData);
    const recipientEmail = this.resolveReceiptRecipientEmail(contact, submissionData);

    const pdf = await this.buildReceiptPdf({
      organization,
      recipientName,
      recipientEmail,
      payment,
      formName: form?.title || 'N/A',
      confirmedByName: this.buildUserDisplayName(confirmingUser),
    });

    const normalizedReference = String(payment.reference || payment.id).replace(/[^a-zA-Z0-9_-]+/g, '_');
    return {
      fileName: `receipt-${normalizedReference}.pdf`,
      content: pdf,
    };
  }

  private async buildReceiptPdf(payload: {
    organization: Pick<Organization, 'id' | 'name' | 'email'>;
    recipientName: string;
    recipientEmail: string;
    payment: Payment;
    formName: string;
    confirmedByName?: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const PDFDocument = require('pdfkit');
      const pdf = new PDFDocument({ margin: 44, size: 'A4' });
      const chunks: Buffer[] = [];

      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      const { organization, recipientName, recipientEmail, payment, formName, confirmedByName } = payload;
      const amount = Number(payment.amount || 0);
      const paidAt = payment.paid_at ? payment.paid_at.toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      const createdAt = payment.created_at ? payment.created_at.toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      const confirmedAt = payment.confirmed_at ? payment.confirmed_at.toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      const paymentType = payment.total_amount && Number(payment.amount) < Number(payment.total_amount) ? 'Partial' : 'Full';
      const paymentMethod = this.formatPaymentMethod(payment.payment_method);
      const gateway = payment.payment_method === 'ONLINE' ? 'Paystack' : 'Manual / Offline';
      const accentColor = '#0f766e';
      const accentSoft = '#ccfbf1';
      const textMuted = '#64748b';
      const textStrong = '#0f172a';
      const borderColor = '#dbe4ee';
      const pageLeft = 44;
      const pageWidth = 523;

      const drawLabelValue = (label: string, value: string, x: number, y: number, width: number) => {
        pdf.font('Helvetica-Bold').fontSize(8).fillColor(textMuted).text(label.toUpperCase(), x, y, {
          width,
        });
        pdf.font('Helvetica').fontSize(11).fillColor(textStrong).text(value, x, y + 14, {
          width,
        });
      };

      const drawInfoRow = (label: string, value: string) => {
        const startY = pdf.y;
        pdf.font('Helvetica').fontSize(10).fillColor(textMuted).text(label, 58, startY, { width: 150 });
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(textStrong).text(value, 210, startY, { width: 290 });
        pdf.strokeColor(borderColor).lineWidth(1).moveTo(58, Math.max(pdf.y, startY + 18) + 8).lineTo(537, Math.max(pdf.y, startY + 18) + 8).stroke();
        pdf.y = Math.max(pdf.y, startY + 18) + 16;
      };

      const drawDetailCard = (x: number, y: number, width: number, title: string, rows: Array<[string, string]>) => {
        const rowHeight = 32;
        const cardHeight = 22 + (rows.length * rowHeight) + 14;
        pdf.roundedRect(x, y, width, cardHeight, 14).fill('#ffffff').strokeColor(borderColor).lineWidth(1).stroke();
        pdf.font('Helvetica-Bold').fontSize(11).fillColor(textStrong).text(title, x + 16, y + 14, { width: width - 32 });

        let currentY = y + 42;
        rows.forEach(([label, value], index) => {
          pdf.font('Helvetica').fontSize(9).fillColor(textMuted).text(label, x + 16, currentY, { width: 90 });
          pdf.font('Helvetica-Bold').fontSize(10).fillColor(textStrong).text(value, x + 110, currentY, { width: width - 126 });
          if (index < rows.length - 1) {
            pdf.strokeColor(borderColor).lineWidth(1).moveTo(x + 16, currentY + 22).lineTo(x + width - 16, currentY + 22).stroke();
          }
          currentY += rowHeight;
        });

        return cardHeight;
      };

      pdf.roundedRect(pageLeft, 36, pageWidth, 104, 18).fill('#f8fafc');
      pdf.roundedRect(pageLeft, 36, 168, 104, 18).fill(accentColor);
      pdf.fillColor('#ffffff').font('Helvetica-Bold').fontSize(21).text('Payment', 60, 60);
      pdf.text('Receipt', 60, 84);
      pdf.font('Helvetica').fontSize(9).fillColor('#d1fae5').text('Official transaction confirmation', 60, 110, {
        width: 132,
      });

      pdf.fillColor(textStrong).font('Helvetica-Bold').fontSize(18).text(organization.name, 232, 56, {
        width: 300,
      });
      pdf.font('Helvetica').fontSize(10).fillColor(textMuted).text('Generated by Payforms', 232, 82);
      drawLabelValue('Receipt Date', createdAt, 232, 102, 134);
      drawLabelValue('Reference', payment.reference, 386, 102, 146);

      pdf.roundedRect(pageLeft, 160, pageWidth, 82, 16).fill(accentSoft);
      drawLabelValue('Amount Paid', `NGN ${amount.toFixed(2)}`, 60, 180, 170);
      drawLabelValue('Status', payment.status, 238, 180, 100);
      drawLabelValue('Payment Type', paymentType, 350, 180, 110);
      drawLabelValue('Method', paymentMethod, 462, 180, 70);
      drawLabelValue('Paid At', paidAt, 60, 214, 220);
      drawLabelValue('Gateway', gateway, 350, 214, 182);

      const leftCardHeight = drawDetailCard(44, 262, 252, 'Receipt Details', [
        ['Form', formName],
        ['Payer', recipientName],
        ['Payer Email', recipientEmail],
        ['Reference', payment.reference],
      ]);
      const rightCardHeight = drawDetailCard(315, 262, 252, 'Organization', [
        ['Organization', organization.name],
        ['Contact', organization.email || 'N/A'],
        ['Status', payment.status],
        ['Method', paymentMethod],
        ['Confirmed At', payment.confirmed_at ? confirmedAt : 'N/A'],
        ['Confirmed By', confirmedByName || 'N/A'],
        ['External Ref', payment.external_reference || 'N/A'],
      ]);

      const footerTop = 262 + Math.max(leftCardHeight, rightCardHeight) + 18;
      const footerHeight = payment.confirmation_note ? 92 : 66;
      pdf.roundedRect(pageLeft, footerTop, pageWidth, footerHeight, 14).fill('#f8fafc');
      pdf.font('Helvetica-Bold').fontSize(11).fillColor(textStrong).text('Note', 60, footerTop + 14);
      pdf.font('Helvetica').fontSize(10).fillColor(textMuted).text(
        'Thank you for your payment. Please keep this receipt for your records. If you need assistance, contact the receiving organization directly.',
        60,
        footerTop + 32,
        { width: 490, lineGap: 3 },
      );
      if (payment.confirmation_note) {
        pdf.font('Helvetica-Bold').fontSize(10).fillColor(textStrong).text('Admin Note', 60, footerTop + 62);
        pdf.font('Helvetica').fontSize(10).fillColor(textMuted).text(payment.confirmation_note, 128, footerTop + 62, {
          width: 422,
          lineGap: 2,
        });
      }

      pdf.end();
    });
  }

  private buildUserDisplayName(user: Pick<User, 'first_name' | 'middle_name' | 'last_name' | 'email'> | null) {
    if (!user) {
      return '';
    }

    const name = [user.first_name, user.middle_name, user.last_name]
      .map(value => value?.trim())
      .filter((value): value is string => !!value)
      .join(' ');

    return name || user.email?.trim() || '';
  }

  private escapeCsv(value: unknown) {
    const raw = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safeValue.replace(/"/g, '""')}"`;
  }

  private resolveReceiptRecipientName(
    contact: Pick<Contact, 'first_name' | 'last_name' | 'email'> | null,
    submissionData: Record<string, any>,
  ) {
    const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ').trim();
    if (contactName) {
      return contactName;
    }

    for (const key of ['name', 'full_name', 'student_name', 'payer_name', 'parent_name']) {
      const value = submissionData?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return contact?.email?.trim() || 'N/A';
  }

  private resolveReceiptRecipientEmail(
    contact: Pick<Contact, 'email'> | null,
    submissionData: Record<string, any>,
  ) {
    if (contact?.email?.trim()) {
      return contact.email.trim();
    }

    for (const key of ['email', 'contact_email', 'payer_email', 'parent_email']) {
      const value = submissionData?.[key];
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }

    return 'N/A';
  }

  private formatPaymentMethod(method?: string | null) {
    return String(method || 'ONLINE')
      .trim()
      .toUpperCase()
      .split('_')
      .map(part => part.charAt(0) + part.slice(1).toLowerCase())
      .join(' ');
  }

  private resolveConfirmationMetadata(
    payment: Payment,
    dto: UpdatePaymentStatusDto,
    options: {
      actorUserId?: string;
      isOfflinePayment: boolean;
      source?: 'admin_update' | 'paystack' | 'system';
      nextStatus: UpdatePaymentStatusDto['status'];
    },
  ) {
    const next = {
      confirmed_at: payment.confirmed_at ?? null,
      confirmed_by_user_id: payment.confirmed_by_user_id ?? null,
      confirmation_note: dto.confirmation_note ?? payment.confirmation_note ?? null,
      external_reference: dto.external_reference ?? payment.external_reference ?? null,
    };

    if (options.source !== 'admin_update' || !options.isOfflinePayment) {
      return next;
    }

    if (options.nextStatus === 'PAID' || options.nextStatus === 'PARTIAL') {
      return {
        ...next,
        confirmed_at: new Date(),
        confirmed_by_user_id: options.actorUserId ?? payment.confirmed_by_user_id ?? null,
      };
    }

    if (options.nextStatus === 'PENDING') {
      return next;
    }

    return {
      ...next,
      confirmed_at: payment.confirmed_at ?? null,
      confirmed_by_user_id: payment.confirmed_by_user_id ?? null,
    };
  }

  private resolveAdminUpdateEvent(status: UpdatePaymentStatusDto['status'], isOfflinePayment: boolean) {
    if (!isOfflinePayment) {
      return 'payment.admin.status_updated';
    }

    if (status === 'FAILED') {
      return 'payment.offline.rejected';
    }

    if (status === 'PAID' || status === 'PARTIAL') {
      return 'payment.offline.confirmed';
    }

    return 'payment.offline.updated';
  }

  private async applyPaystackOutcome(params: {
    organizationId: string;
    payment: Payment;
    event: string;
    eventId: string;
    paystackData: any;
  }) {
    const { organizationId, payment, event, eventId, paystackData } = params;

    const existingLog = await this.paymentLogRepository.findOne({
      where: { payment_id: payment.id, event_id: eventId },
    });
    if (existingLog) {
      return { success: true, skipped: true, payment };
    }

    const previousStatus = payment.status;
    const status = this.mapPaystackStatusToPaymentStatus(paystackData?.status);
    const paidAt = (status === 'PAID' || status === 'PARTIAL') && paystackData?.paid_at
      ? new Date(paystackData.paid_at)
      : undefined;

    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    const paystackAmount = paystackData?.amount ? Number(paystackData.amount) / 100 : undefined;

    if (status === 'PARTIAL' && org?.partial_payment_limit != null && paystackAmount != null) {
      const partialLimit = Number(org.partial_payment_limit);
      if (paystackAmount < partialLimit) {
        throw new BadRequestException(`Partial payment must be at least ${partialLimit}`);
      }
    }

    const updatedPayment = await this.updateStatus(organizationId, payment.id, {
      status,
      paid_at: paidAt,
      amount_paid: paystackAmount,
    }, {
      source: 'paystack',
    });

    await this.paymentLogRepository.save(
      this.paymentLogRepository.create({
        organization_id: organizationId,
        payment_id: payment.id,
        event_id: eventId,
        event,
        payload: paystackData,
      }),
    );

    await this.maybeSendPaymentNotifications(
      organizationId,
      updatedPayment ?? payment,
      paystackData,
      previousStatus,
      status,
    );

    return { success: true, payment: updatedPayment ?? payment };
  }

  private async maybeSendPaymentNotifications(
    organizationId: string,
    payment: Payment,
    paystackData: any,
    previousStatus: Payment['status'],
    nextStatus: Payment['status'],
  ) {
    if (previousStatus === nextStatus) {
      return;
    }

    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) {
      return;
    }

    const recipientEmail = await this.resolveRecipientEmail(organizationId, payment, paystackData);
    if (!recipientEmail) {
      return;
    }

    try {
      if (nextStatus === 'PAID' && org.notify_payment_confirmation) {
        const receiptAttachment = await this.buildReceiptAttachmentIfAvailable(organizationId, payment);
        await this.notificationService.sendPaymentConfirmation(
          org,
          recipientEmail,
          Number(payment.amount),
          payment.reference,
          receiptAttachment ? [receiptAttachment] : undefined,
        );
      } else if (nextStatus === 'FAILED' && org.notify_payment_failure) {
        await this.notificationService.sendFailedPaymentReminder(
          org,
          recipientEmail,
          Number(payment.amount),
          payment.reference,
        );
      }
    } catch (error) {
      console.warn('Payment notification email failed:', error);
    }
  }

  private async resolveRecipientEmail(organizationId: string, payment: Payment, paystackData: any) {
    let recipientEmail: string | undefined = paystackData?.customer?.email;

    if (payment.submission?.contact_id) {
      const contact = await this.contactRepository.findOne({
        where: { id: payment.submission.contact_id, organization_id: organizationId },
        select: ['email'],
      });
      if (contact?.email) {
        recipientEmail = contact.email;
      }
    }

    return recipientEmail;
  }

  private async buildReceiptAttachmentIfAvailable(
    organizationId: string,
    payment: Payment,
  ): Promise<{ filename: string; content: Buffer; type: string } | null> {
    if (!payment.submission?.contact_id) {
      return null;
    }

    try {
      const receipt = await this.generateContactReceiptByPaymentId(
        organizationId,
        payment.submission.contact_id,
        payment.id,
      );
      return {
        filename: receipt.fileName,
        content: receipt.content,
        type: 'application/pdf',
      };
    } catch (error) {
      return null;
    }
  }

  private buildVerificationEventId(source: 'manual_verify' | 'callback_redirect', reference: string, paystackId?: string | number) {
    if (paystackId !== undefined && paystackId !== null) {
      return `paystack.verify:${source}:${String(paystackId)}`;
    }
    return `paystack.verify:${source}:${reference}`;
  }
}
