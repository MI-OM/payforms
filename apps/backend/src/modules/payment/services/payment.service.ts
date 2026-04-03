import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, IsNull } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { Payment } from '../entities/payment.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { PaymentLog } from '../../audit/entities/payment-log.entity';
import { Submission } from '../../submission/entities/submission.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { NotificationService } from '../../notification/notification.service';
import { CreatePaymentDto, UpdatePaymentStatusDto } from '../dto/payment.dto';

type TransactionFilters = {
  status?: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
  reference?: string;
  form_id?: string;
  contact_id?: string;
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
    @InjectRepository(PaymentLog)
    private paymentLogRepository: Repository<PaymentLog>,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async create(organizationId: string, dto: CreatePaymentDto) {
    const reference = dto.reference || `REF-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const payment = this.paymentRepository.create({
      organization_id: organizationId,
      submission_id: dto.submission_id,
      amount: dto.amount,
      reference,
      status: 'PENDING',
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

  async exportTransactions(organizationId: string, filters: TransactionFilters) {
    const payments = await this.buildTransactionsQuery(organizationId, filters)
      .orderBy('payment.created_at', 'DESC')
      .getMany();

    return this.buildPaymentsCsv(payments);
  }

  async exportByOrganization(organizationId: string) {
    const payments = await this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .orderBy('payment.created_at', 'DESC')
      .getMany();

    return this.buildPaymentsCsv(payments);
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

  async updateStatus(organizationId: string, id: string, dto: UpdatePaymentStatusDto) {
    await this.paymentRepository.update({ id, organization_id: organizationId }, {
      status: dto.status,
      paid_at: dto.status === 'PAID' ? (dto.paid_at ?? new Date()) : null,
    });
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
        customerEmail = contact?.email;
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
    if (normalized === 'failed' || normalized === 'abandoned') {
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
      qb.andWhere('payment.status = :status', { status: filters.status });
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

    if (filters.start_date) {
      qb.andWhere('payment.created_at >= :start_date', { start_date: filters.start_date });
    }

    if (filters.end_date) {
      qb.andWhere('payment.created_at <= :end_date', { end_date: filters.end_date });
    }

    return qb;
  }

  private buildPaymentsCsv(payments: Payment[]) {
    const rows = payments.map(payment =>
      [
        payment.id,
        payment.reference,
        payment.amount,
        payment.status,
        payment.paid_at ? payment.paid_at.toISOString() : '',
        payment.created_at ? payment.created_at.toISOString() : '',
        payment.submission_id ?? '',
        payment.submission?.form_id ?? '',
        payment.submission?.contact_id ?? '',
      ].map(value => this.escapeCsv(value)).join(','),
    );

    return `id,reference,amount,status,paid_at,created_at,submission_id,form_id,contact_id\n${rows.join('\n')}`;
  }

  private escapeCsv(value: unknown) {
    const raw = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safeValue.replace(/"/g, '""')}"`;
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
    const paidAt = status === 'PAID' && paystackData?.paid_at
      ? new Date(paystackData.paid_at)
      : undefined;

    const updatedPayment = await this.updateStatus(organizationId, payment.id, { status, paid_at: paidAt });

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
        await this.notificationService.sendPaymentConfirmation(
          org,
          recipientEmail,
          payment.amount,
          payment.reference,
        );
      } else if (nextStatus === 'FAILED' && org.notify_payment_failure) {
        await this.notificationService.sendFailedPaymentReminder(
          org,
          recipientEmail,
          payment.amount,
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

  private buildVerificationEventId(source: 'manual_verify' | 'callback_redirect', reference: string, paystackId?: string | number) {
    if (paystackId !== undefined && paystackId !== null) {
      return `paystack.verify:${source}:${String(paystackId)}`;
    }
    return `paystack.verify:${source}:${reference}`;
  }
}
