import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { ContactQrCode } from '../entities/contact-qr-code.entity';
import { QrCodeScan } from '../entities/qr-code-scan.entity';
import { Contact } from '../entities/contact.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Submission } from '../../submission/entities/submission.entity';

export interface ContactPaymentStatus {
  contact_id: string;
  contact_name: string;
  contact_email: string | null;
  student_id: string | null;
  total_balance_due: number;
  total_paid: number;
  payments: Array<{
    id: string;
    form_name: string;
    amount: number;
    amount_paid: number;
    balance_due: number;
    status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
    created_at: Date;
    paid_at: Date | null;
  }>;
}

@Injectable()
export class ContactQrCodeService {
  private readonly logger = new Logger(ContactQrCodeService.name);

  constructor(
    @InjectRepository(ContactQrCode)
    private qrCodeRepository: Repository<ContactQrCode>,
    @InjectRepository(QrCodeScan)
    private scanRepository: Repository<QrCodeScan>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
  ) {}

  /**
   * Generate or get a QR code for a contact.
   * If contact doesn't have a QR code, creates one automatically.
   */
  async getOrCreateQrCode(organizationId: string, contactId: string): Promise<ContactQrCode> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Check if QR code already exists
    let qrCode = await this.qrCodeRepository.findOne({
      where: { organization_id: organizationId, contact_id: contactId },
    });

    if (!qrCode) {
      // Create new QR code with random token
      const qrToken = this.generateQrToken();
      qrCode = this.qrCodeRepository.create({
        organization_id: organizationId,
        contact_id: contactId,
        qr_token: qrToken,
        is_active: true,
      });
      qrCode = await this.qrCodeRepository.save(qrCode);
    }

    return qrCode;
  }

  /**
   * Get a QR code by token (used for public/authenticated access).
   */
  async getQrCodeByToken(qrToken: string): Promise<ContactQrCode | null> {
    if (!qrToken?.trim()) {
      return null;
    }

    const qrCode = await this.qrCodeRepository.findOne({
      where: { qr_token: qrToken, is_active: true },
      relations: ['contact', 'organization'],
    });

    return qrCode || null;
  }

  /**
   * Get payment status for a contact (used in QR views).
   * Returns all outstanding and recent payments.
   */
  async getContactPaymentStatus(organizationId: string, contactId: string): Promise<ContactPaymentStatus> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    // Get all payments for this contact
    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.submission', 'submission')
      .innerJoin('submission.form', 'form')
      .where('submission.organization_id = :organizationId', { organizationId })
      .andWhere('submission.contact_id = :contactId', { contactId })
      .select([
        'payment.id',
        'payment.amount',
        'payment.amount_paid',
        'payment.balance_due',
        'payment.status',
        'payment.created_at',
        'payment.paid_at',
        'form.title',
      ])
      .orderBy('payment.created_at', 'DESC')
      .getMany();

    const totalBalance = payments.reduce((sum, p) => sum + Number(p.balance_due || 0), 0);
    const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount_paid || 0), 0);

    const contactName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Student';

    return {
      contact_id: contact.id,
      contact_name: contactName,
      contact_email: contact.email,
      student_id: contact.student_id,
      total_balance_due: totalBalance,
      total_paid: totalPaid,
      payments: payments.map((p: any) => ({
        id: p.id,
        form_name: p.submission?.form?.title || 'Payment',
        amount: Number(p.amount),
        amount_paid: Number(p.amount_paid),
        balance_due: Number(p.balance_due),
        status: p.status,
        created_at: p.created_at,
        paid_at: p.paid_at,
      })),
    };
  }

  /**
   * Record a QR code scan (audit trail).
   */
  async recordScan(
    qrCodeId: string,
    organizationId: string,
    contactId: string,
    accessMode: 'public' | 'authenticated' | 'staff',
    options?: {
      scannedByUserId?: string | null;
      ipAddress?: string | null;
      userAgent?: string | null;
    },
  ): Promise<QrCodeScan> {
    const scan = this.scanRepository.create({
      qr_code_id: qrCodeId,
      organization_id: organizationId,
      contact_id: contactId,
      access_mode: accessMode,
      scanned_by_user_id: options?.scannedByUserId || null,
      ip_address: options?.ipAddress || null,
      user_agent: options?.userAgent || null,
    });

    return this.scanRepository.save(scan);
  }

  /**
   * Regenerate a QR code token (security measure if compromised).
   * Old token becomes inactive but history is preserved.
   */
  async regenerateQrToken(organizationId: string, contactId: string): Promise<ContactQrCode> {
    const qrCode = await this.qrCodeRepository.findOne({
      where: { organization_id: organizationId, contact_id: contactId },
    });

    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    const newToken = this.generateQrToken();
    qrCode.qr_token = newToken;
    qrCode.regenerated_at = new Date();

    return this.qrCodeRepository.save(qrCode);
  }

  /**
   * Disable a QR code (soft delete).
   */
  async disableQrCode(organizationId: string, contactId: string): Promise<void> {
    const qrCode = await this.qrCodeRepository.findOne({
      where: { organization_id: organizationId, contact_id: contactId },
    });

    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    await this.qrCodeRepository.update(
      { id: qrCode.id },
      { is_active: false },
    );
  }

  /**
   * Enable a previously disabled QR code.
   */
  async enableQrCode(organizationId: string, contactId: string): Promise<void> {
    const qrCode = await this.qrCodeRepository.findOne({
      where: { organization_id: organizationId, contact_id: contactId },
    });

    if (!qrCode) {
      throw new NotFoundException('QR code not found');
    }

    await this.qrCodeRepository.update(
      { id: qrCode.id },
      { is_active: true },
    );
  }

  /**
   * Get scan history for a QR code.
   */
  async getScanHistory(
    organizationId: string,
    contactId: string,
    limit: number = 50,
  ): Promise<QrCodeScan[]> {
    return this.scanRepository.find({
      where: { organization_id: organizationId, contact_id: contactId },
      relations: ['scanned_by'],
      order: { scanned_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Generate a cryptographically random QR token.
   * 32 bytes of entropy, URL-safe base64 encoded.
   */
  private generateQrToken(): string {
    const randomBytes = crypto.randomBytes(32);
    return randomBytes.toString('base64url');
  }

  /**
   * Get QR code URL (for generating QR image).
   * Format: {PUBLIC_API_BASE_URL}/qr/{qr_token}
   */
  getQrCodeUrl(qrToken: string, baseUrl: string): string {
    return `${baseUrl.replace(/\/$/, '')}/qr/${qrToken}`;
  }

  /**
   * Get QR code display data for org admin.
   */
  async getQrCodeDisplayData(organizationId: string, contactId: string, baseUrl: string): Promise<{
    qr_code: ContactQrCode;
    qr_url: string;
    last_scan: QrCodeScan | null;
    scan_count_last_30_days: number;
  }> {
    const qrCode = await this.getOrCreateQrCode(organizationId, contactId);
    const qrUrl = this.getQrCodeUrl(qrCode.qr_token, baseUrl);

    const lastScan = await this.scanRepository.findOne({
      where: { qr_code_id: qrCode.id },
      order: { scanned_at: 'DESC' },
    });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const scanCountLast30Days = await this.scanRepository.count({
      where: {
        qr_code_id: qrCode.id,
        scanned_at: new Date(thirtyDaysAgo),
      },
    });

    return {
      qr_code: qrCode,
      qr_url: qrUrl,
      last_scan: lastScan || null,
      scan_count_last_30_days: scanCountLast30Days,
    };
  }
}
