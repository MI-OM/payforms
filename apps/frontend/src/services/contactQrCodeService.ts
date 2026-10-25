import { apiClient } from './api';

/**
 * Client for the QR Code payment status feature.
 *
 * The backend records the scan as part of every view endpoint, so the client
 * does not need a separate "record scan" round trip — `recordScan` below is a
 * client-side no-op kept so the pages read the way they are meant to.
 */

export type ScanMode = 'public' | 'authenticated' | 'staff';

export interface QrCode {
  id: string;
  contactId: string;
  token: string;
  qrUrl: string;
  isActive: boolean;
  createdAt: string;
  regeneratedAt: string | null;
  scanCount: number;
  lastUsedAt: string | null;
}

export interface ScanHistory {
  id: string;
  mode: ScanMode;
  timestamp: string;
  userAgent?: string;
  ipAddress: string | null;
  location: { city: string | null; country: string | null } | null;
  deviceType: string | null;
}

export interface Payment {
  id: string;
  amount: number;
  amountPaid: number;
  balanceDue: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
  category: string;
  description: string;
  date: string;
  referenceId: string;
  reference?: string;
}

export interface PaymentBreakdownItem {
  category: string;
  description: string;
  amount: number;
  balanceDue: number;
}

export interface PaymentSummary {
  studentName: string;
  schoolName: string;
  totalAmount: number;
  paidAmount: number;
  balanceDue: number;
  daysOverdue: number;
  breakdown: PaymentBreakdownItem[];
}

export interface PaymentDetails extends PaymentSummary {
  contactEmail: string;
  studentId: string | null;
  payments: Payment[];
}

export interface RecordScanInput {
  scanMode: ScanMode;
  userAgent?: string;
  timestamp?: Date;
}

/** Raw shapes returned by the backend (snake_case). */
interface RawQrCode {
  id: string;
  contact_id: string;
  qr_token: string;
  is_active: boolean;
  created_at: string;
  regenerated_at: string | null;
}

interface RawQrCodeDisplay {
  qr_code: RawQrCode;
  qr_url: string;
  last_scan: RawScan | null;
  scan_count_last_30_days: number;
}

interface RawScan {
  id: string;
  access_mode: ScanMode;
  scanned_at: string;
  user_agent: string | null;
  ip_address: string | null;
  scanned_by?: { first_name?: string; last_name?: string; email?: string } | null;
}

interface RawPayment {
  id: string;
  form_name: string;
  amount: number;
  amount_paid: number;
  balance_due: number;
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';
  created_at: string;
  paid_at: string | null;
}

interface RawPaymentStatus {
  contact_id: string;
  contact_name: string;
  contact_email: string | null;
  student_id: string | null;
  total_balance_due: number;
  total_paid: number;
  payments: RawPayment[];
}

const toQrCode = (raw: RawQrCode, qrUrl: string, scanCount: number): QrCode => ({
  id: raw.id,
  contactId: raw.contact_id,
  token: raw.qr_token,
  qrUrl,
  isActive: raw.is_active,
  createdAt: raw.created_at,
  regeneratedAt: raw.regenerated_at ?? null,
  scanCount,
  lastUsedAt: null,
});

const toScanHistory = (raw: RawScan): ScanHistory => {
  const userAgent = raw.user_agent ?? undefined;

  return {
    id: raw.id,
    mode: raw.access_mode,
    timestamp: raw.scanned_at,
    userAgent,
    ipAddress: raw.ip_address,
    // The backend records the client IP and user agent but does not geocode
    // them, so there is no location to show.
    location: null,
    deviceType: userAgent ? userAgent.split(' ')[0] : null,
  };
};

const toPayments = (raw: RawPayment[]): Payment[] =>
  raw.map(payment => ({
    id: payment.id,
    amount: Number(payment.amount),
    amountPaid: Number(payment.amount_paid),
    balanceDue: Number(payment.balance_due),
    status: payment.status,
    category: payment.form_name,
    description: payment.form_name,
    date: payment.paid_at ?? payment.created_at,
    referenceId: payment.id,
  }));

const toBreakdown = (payments: Payment[]): PaymentBreakdownItem[] =>
  payments.map(payment => ({
    category: payment.category,
    description: payment.description,
    amount: payment.amount,
    balanceDue: payment.balanceDue,
  }));

class ContactQrCodeService {
  /**
   * Get (or create) the QR code for a contact, along with its scan stats.
   */
  async getQrCodeStatus(contactId: string): Promise<QrCode> {
    const data: RawQrCodeDisplay = await apiClient.get(`/qr/details/${contactId}`);
    return toQrCode(data.qr_code, data.qr_url, data.scan_count_last_30_days);
  }

  /**
   * Generate the QR code for a contact.
   */
  async generateQrCode(contactId: string): Promise<QrCode> {
    const data: RawQrCodeDisplay = await apiClient.post(`/qr/generate/${contactId}`);
    return toQrCode(data.qr_code, data.qr_url, data.scan_count_last_30_days);
  }

  /**
   * Regenerate the QR token, invalidating the previous one.
   */
  async regenerateQrCode(contactId: string): Promise<QrCode> {
    const data = await apiClient.post(`/qr/regenerate/${contactId}`);
    const raw: RawQrCode = data.qr_code;
    return toQrCode(raw, data.qr_url ?? '', 0);
  }

  /**
   * Download the QR code as a PNG image.
   *
   * The API renders QR images from the public QR URL, so this fetches that
   * image rather than re-implementing QR encoding on the client.
   */
  async downloadQrCode(contactId: string): Promise<Blob> {
    const qr = await this.getQrCodeStatus(contactId);
    const response = await fetch(
      `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qr.qrUrl)}`,
    );

    if (!response.ok) {
      throw new Error('Failed to render QR code image');
    }

    return response.blob();
  }

  /**
   * Scan history for a contact's QR code.
   */
  async getScanHistory(contactId: string): Promise<ScanHistory[]> {
    const data: RawScan[] = await apiClient.get(`/qr/scan-history/${contactId}`);
    return (data || []).map(toScanHistory);
  }

  /**
   * Public payment summary for a scanned QR code (no authentication).
   */
  async getPublicSummary(token: string): Promise<PaymentSummary> {
    const data = await apiClient.get(`/qr/view/public/${encodeURIComponent(token)}`);

    const totalAmount = Number(data.total_balance_due) || 0;
    const paidAmount = Number(data.paid_amount) || 0;

    return {
      studentName: data.contact_name ?? 'Contact',
      schoolName: data.organization_name ?? '',
      totalAmount,
      paidAmount,
      balanceDue: totalAmount,
      daysOverdue: 0,
      breakdown: data.breakdown ?? [],
    };
  }

  /**
   * Detailed payment status for the authenticated contact.
   */
  async getAuthenticatedDetails(token: string): Promise<PaymentDetails> {
    const data: RawPaymentStatus = await apiClient.get(
      `/qr/view/authenticated/${encodeURIComponent(token)}`,
    );
    return this.toPaymentDetails(data);
  }

  /**
   * Detailed payment status for a staff member who scanned the code.
   */
  async getStaffDetails(token: string): Promise<PaymentDetails> {
    const data: RawPaymentStatus = await apiClient.post(
      `/qr/scan/${encodeURIComponent(token)}`,
    );
    return this.toPaymentDetails(data);
  }

  /**
   * Record a scan.
   *
   * The backend records the scan inside each view endpoint, so there is nothing
   * to call here — this exists so callers can express intent without issuing a
   * duplicate request.
   */
  async recordScan(token: string, input: RecordScanInput): Promise<void> {
    void token;
    void input;
  }

  private toPaymentDetails(data: RawPaymentStatus): PaymentDetails {
    const payments = toPayments(data.payments || []);
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const paidAmount = Number(data.total_paid) || 0;

    return {
      studentName: data.contact_name ?? 'Contact',
      contactEmail: data.contact_email ?? '',
      studentId: data.student_id ?? null,
      schoolName: '',
      totalAmount,
      paidAmount,
      balanceDue: Number(data.total_balance_due) || 0,
      daysOverdue: 0,
      breakdown: toBreakdown(payments),
      payments,
    };
  }
}

export const contactQrCodeService = new ContactQrCodeService();
