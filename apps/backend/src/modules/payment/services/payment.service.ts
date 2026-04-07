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

  async generateContactReceiptByPaymentId(organizationId: string, contactId: string, paymentId: string) {
    return this.generateContactReceipt(organizationId, contactId, { paymentId });
  }

  async generateContactReceiptByReference(organizationId: string, contactId: string, reference: string) {
    return this.generateContactReceipt(organizationId, contactId, { reference });
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
    const payment = await this.findById(organizationId, id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
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

    await this.paymentRepository.update({ id, organization_id: organizationId }, {
      status: dto.status,
      paid_at: dto.status === 'PAID' || dto.status === 'PARTIAL' ? (dto.paid_at ?? new Date()) : null,
      amount_paid,
      balance_due,
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

    const [organization, contact] = await Promise.all([
      this.organizationRepository.findOne({
        where: { id: organizationId },
        select: ['id', 'name', 'email'],
      }),
      this.contactRepository.findOne({
        where: { id: contactId, organization_id: organizationId },
        select: ['id', 'first_name', 'last_name', 'email'],
      }),
    ]);

    if (!organization || !contact) {
      throw new NotFoundException('Receipt owner not found');
    }

    const pdf = await this.buildReceiptPdf({
      organization,
      contact,
      payment,
    });

    const normalizedReference = String(payment.reference || payment.id).replace(/[^a-zA-Z0-9_-]+/g, '_');
    return {
      fileName: `receipt-${normalizedReference}.pdf`,
      content: pdf,
    };
  }

  private async buildReceiptPdf(payload: {
    organization: Pick<Organization, 'id' | 'name' | 'email'>;
    contact: Pick<Contact, 'id' | 'first_name' | 'last_name' | 'email'>;
    payment: Payment;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const PDFDocument = require('pdfkit');
      const pdf = new PDFDocument({ margin: 40 });
      const chunks: Buffer[] = [];

      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      const { organization, contact, payment } = payload;
      const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'N/A';
      const amount = Number(payment.amount || 0);
      const paidAt = payment.paid_at ? payment.paid_at.toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      const createdAt = payment.created_at ? payment.created_at.toISOString().replace('T', ' ').replace('Z', '') : 'N/A';
      const paymentType = payment.total_amount && Number(payment.amount) < Number(payment.total_amount) ? 'Partial' : 'Full';

      pdf.fillColor('#333').fontSize(22).text('Payment Receipt', { align: 'center' });
      pdf.moveDown(0.5);
      pdf.strokeColor('#e2e8f0').lineWidth(1).moveTo(40, pdf.y).lineTo(555, pdf.y).stroke();
      pdf.moveDown(1);

      pdf.fontSize(10).fillColor('#718096');
      pdf.text(`Date: ${createdAt}`, { align: 'right' });
      pdf.moveDown(1);

      pdf.fillColor('#2d3748').fontSize(12).text(organization.name, { continued: true });
      pdf.fontSize(10).fillColor('#718096').text(`  |  Receipt`, { continued: false });
      pdf.moveDown(1);

      pdf.fontSize(11).fillColor('#4a5568');
      pdf.text('Transaction Details', { underline: true });
      pdf.moveDown(0.5);

      const row = (label: string, value: string) => {
        pdf.fillColor('#718096').fontSize(10).text(label, { continued: true, width: 180 });
        pdf.fillColor('#2d3748').fontSize(10).text(value);
      };

      row('Reference:', payment.reference);
      row('Status:', payment.status);
      row('Payment Type:', paymentType);
      row('Payment Gateway:', 'Paystack');
      row('Amount:', `₦${amount.toFixed(2)}`);
      row('Paid At:', paidAt);
      row('Form ID:', payment.submission?.form_id || 'N/A');
      row('Submission ID:', payment.submission_id || 'N/A');
      row('Contact:', contactName);
      row('Contact Email:', contact.email || 'N/A');

      pdf.moveDown(1);
      pdf.fillColor('#2d3748').fontSize(11).text('Notes', { underline: true });
      pdf.moveDown(0.5);
      pdf.fillColor('#4a5568').fontSize(10).text(
        'Thank you for your payment. Please keep this receipt for your records. If you need assistance, contact the receiving organization directly.',
      );

      pdf.end();
    });
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
