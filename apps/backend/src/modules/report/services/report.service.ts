import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from '../../form/entities/form.entity';
import { Submission } from '../../submission/entities/submission.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Contact } from '../../contact/entities/contact.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Form) private formRepository: Repository<Form>,
    @InjectRepository(Submission) private submissionRepository: Repository<Submission>,
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(Contact) private contactRepository: Repository<Contact>,
  ) {}

  private parseDateRange(startDate?: string, endDate?: string) {
    const range: { start?: Date; end?: Date } = {};
    if (startDate) {
      range.start = new Date(startDate);
      if (Number.isNaN(range.start.getTime())) {
        throw new BadRequestException('Invalid start_date');
      }
    }
    if (endDate) {
      range.end = new Date(endDate);
      if (Number.isNaN(range.end.getTime())) {
        throw new BadRequestException('Invalid end_date');
      }
    }
    return range;
  }

  async getSummary(organizationId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    const formCount = await this.formRepository.count({ where: { organization_id: organizationId } });
    const contactCount = await this.contactRepository.count({ where: { organization_id: organizationId } });

    const submissionQuery = this.submissionRepository.createQueryBuilder('submission')
      .where('submission.organization_id = :organizationId', { organizationId });

    if (start) {
      submissionQuery.andWhere('submission.created_at >= :start', { start });
    }
    if (end) {
      submissionQuery.andWhere('submission.created_at <= :end', { end });
    }

    const submissionCount = await submissionQuery.getCount();

    const paymentQuery = this.paymentRepository.createQueryBuilder('payment')
      .select('COUNT(payment.id)', 'count')
      .addSelect('SUM(payment.amount)', 'total')
      .addSelect('SUM(CASE WHEN payment.status = :paid THEN payment.amount ELSE 0 END)', 'paid_total')
      .addSelect('SUM(CASE WHEN payment.status = :pending THEN payment.amount ELSE 0 END)', 'pending_total')
      .addSelect('SUM(CASE WHEN payment.status = :failed THEN payment.amount ELSE 0 END)', 'failed_total')
      .addSelect('SUM(CASE WHEN payment.status = :partial THEN payment.amount ELSE 0 END)', 'partial_total')
      .where('payment.organization_id = :organizationId', { organizationId })
      .setParameters({ paid: 'PAID', pending: 'PENDING', failed: 'FAILED', partial: 'PARTIAL' });

    if (start) {
      paymentQuery.andWhere('payment.created_at >= :start', { start });
    }
    if (end) {
      paymentQuery.andWhere('payment.created_at <= :end', { end });
    }

    const paymentResult = await paymentQuery.getRawOne();

    return {
      forms: formCount,
      contacts: contactCount,
      submissions: submissionCount,
      payments: parseInt(paymentResult.count, 10) || 0,
      payment_total: Number(paymentResult.total || 0),
      payment_paid_total: Number(paymentResult.paid_total || 0),
      payment_pending_total: Number(paymentResult.pending_total || 0),
      payment_failed_total: Number(paymentResult.failed_total || 0),
      payment_partial_total: Number(paymentResult.partial_total || 0),
      range: {
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
      },
    };
  }

  async getAnalytics(organizationId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    const queryStart = start ?? new Date(Date.now() - 1000 * 60 * 60 * 24 * 30);
    const queryEnd = end ?? new Date();

    const submissionsByDay = await this.submissionRepository
      .createQueryBuilder('submission')
      .select("DATE_TRUNC('day', submission.created_at)", 'day')
      .addSelect('COUNT(submission.id)', 'count')
      .where('submission.organization_id = :organizationId', { organizationId })
      .andWhere('submission.created_at BETWEEN :queryStart AND :queryEnd', { queryStart, queryEnd })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const paymentsByDay = await this.paymentRepository
      .createQueryBuilder('payment')
      .select("DATE_TRUNC('day', payment.created_at)", 'day')
      .addSelect('SUM(payment.amount)', 'total')
      .addSelect('COUNT(payment.id)', 'count')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.created_at BETWEEN :queryStart AND :queryEnd', { queryStart, queryEnd })
      .groupBy('day')
      .orderBy('day', 'ASC')
      .getRawMany();

    const paymentStatusBreakdown = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('payment.status', 'status')
      .addSelect('COUNT(payment.id)', 'count')
      .addSelect('SUM(payment.amount)', 'total_amount')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.created_at BETWEEN :queryStart AND :queryEnd', { queryStart, queryEnd })
      .groupBy('payment.status')
      .getRawMany();

    return {
      range: {
        start: queryStart.toISOString(),
        end: queryEnd.toISOString(),
      },
      submissions_by_day: submissionsByDay.map(row => ({ day: row.day.toISOString().slice(0, 10), count: Number(row.count) })),
      payments_by_day: paymentsByDay.map(row => ({ day: row.day.toISOString().slice(0, 10), total: Number(row.total), count: Number(row.count) })),
      payment_status_breakdown: paymentStatusBreakdown.map(row => ({ status: row.status, count: Number(row.count), total_amount: Number(row.total_amount) })),
    };
  }

  async getFormPerformance(organizationId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    const forms = await this.formRepository.find({
      where: { organization_id: organizationId },
      select: ['id', 'title', 'slug', 'is_active', 'created_at'],
      order: { created_at: 'DESC' },
    });

    const submissionsQuery = this.submissionRepository
      .createQueryBuilder('submission')
      .select('submission.form_id', 'form_id')
      .addSelect('COUNT(submission.id)', 'submissions')
      .where('submission.organization_id = :organizationId', { organizationId });

    if (start) {
      submissionsQuery.andWhere('submission.created_at >= :start', { start });
    }
    if (end) {
      submissionsQuery.andWhere('submission.created_at <= :end', { end });
    }

    const submissionsByForm = await submissionsQuery
      .groupBy('submission.form_id')
      .getRawMany();

    const paymentsQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.submission', 'submission')
      .select('submission.form_id', 'form_id')
      .addSelect('COUNT(payment.id)', 'payments')
      .addSelect('SUM(CASE WHEN payment.status = :paid THEN 1 ELSE 0 END)', 'paid_payments')
      .addSelect('SUM(CASE WHEN payment.status = :pending THEN 1 ELSE 0 END)', 'pending_payments')
      .addSelect('SUM(CASE WHEN payment.status = :failed THEN 1 ELSE 0 END)', 'failed_payments')
      .addSelect('SUM(CASE WHEN payment.status = :partial THEN 1 ELSE 0 END)', 'partial_payments')
      .addSelect('SUM(payment.amount)', 'amount_total')
      .addSelect('SUM(CASE WHEN payment.status = :paid THEN payment.amount ELSE 0 END)', 'paid_amount_total')
      .addSelect('SUM(CASE WHEN payment.status = :pending THEN payment.amount ELSE 0 END)', 'pending_amount_total')
      .addSelect('SUM(CASE WHEN payment.status = :failed THEN payment.amount ELSE 0 END)', 'failed_amount_total')
      .addSelect('SUM(CASE WHEN payment.status = :partial THEN payment.amount ELSE 0 END)', 'partial_amount_total')
      .where('payment.organization_id = :organizationId', { organizationId })
      .setParameters({ paid: 'PAID', pending: 'PENDING', failed: 'FAILED', partial: 'PARTIAL' });

    if (start) {
      paymentsQuery.andWhere('payment.created_at >= :start', { start });
    }
    if (end) {
      paymentsQuery.andWhere('payment.created_at <= :end', { end });
    }

    const paymentsByForm = await paymentsQuery
      .groupBy('submission.form_id')
      .getRawMany();

    const submissionMap = new Map(submissionsByForm.map(row => [row.form_id, Number(row.submissions || 0)]));
    const paymentMap = new Map(paymentsByForm.map(row => [row.form_id, row]));

    const data = forms.map(form => {
      const submissionCount = submissionMap.get(form.id) || 0;
      const paymentRow = paymentMap.get(form.id) || {};

      const payments = Number(paymentRow.payments || 0);
      const paidPayments = Number(paymentRow.paid_payments || 0);
      const pendingPayments = Number(paymentRow.pending_payments || 0);
      const failedPayments = Number(paymentRow.failed_payments || 0);
      const partialPayments = Number(paymentRow.partial_payments || 0);
      const amountTotal = Number(paymentRow.amount_total || 0);
      const paidAmountTotal = Number(paymentRow.paid_amount_total || 0);
      const pendingAmountTotal = Number(paymentRow.pending_amount_total || 0);
      const failedAmountTotal = Number(paymentRow.failed_amount_total || 0);
      const partialAmountTotal = Number(paymentRow.partial_amount_total || 0);

      const completionRate = submissionCount > 0
        ? Number(((paidPayments / submissionCount) * 100).toFixed(2))
        : 0;
      const collectionRate = amountTotal > 0
        ? Number(((paidAmountTotal / amountTotal) * 100).toFixed(2))
        : 0;

      return {
        form_id: form.id,
        title: form.title,
        slug: form.slug,
        is_active: form.is_active,
        created_at: form.created_at?.toISOString() ?? null,
        submissions: submissionCount,
        payments,
        paid_payments: paidPayments,
        pending_payments: pendingPayments,
        failed_payments: failedPayments,
        partial_payments: partialPayments,
        amount_total: amountTotal,
        paid_amount_total: paidAmountTotal,
        pending_amount_total: pendingAmountTotal,
        failed_amount_total: failedAmountTotal,
        partial_amount_total: partialAmountTotal,
        completion_rate: completionRate,
        collection_rate: collectionRate,
      };
    });

    const totals = data.reduce(
      (acc, row) => ({
        submissions: acc.submissions + row.submissions,
        payments: acc.payments + row.payments,
        amount_total: acc.amount_total + row.amount_total,
        paid_amount_total: acc.paid_amount_total + row.paid_amount_total,
      }),
      { submissions: 0, payments: 0, amount_total: 0, paid_amount_total: 0 },
    );

    return {
      range: {
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
      },
      totals: {
        forms: forms.length,
        submissions: totals.submissions,
        payments: totals.payments,
        amount_total: totals.amount_total,
        paid_amount_total: totals.paid_amount_total,
      },
      data,
    };
  }

  async exportReport(organizationId: string, type: 'summary' | 'analytics', format: 'csv' | 'pdf', startDate?: string, endDate?: string) {
    const data = type === 'analytics'
      ? await this.getAnalytics(organizationId, startDate, endDate)
      : await this.getSummary(organizationId, startDate, endDate);

    if (format === 'csv') {
      return this.buildCsv(type, data);
    }

    if (format === 'pdf') {
      return await this.buildPdf(type, data);
    }

    throw new BadRequestException('Unsupported export format');
  }

  private buildCsv(type: 'summary' | 'analytics', data: any) {
    if (type === 'summary') {
      const rows = [
        ['Metric', 'Value'],
        ['Forms', data.forms],
        ['Contacts', data.contacts],
        ['Submissions', data.submissions],
        ['Payments', data.payments],
        ['Payment Total', data.payment_total],
        ['Paid Total', data.payment_paid_total],
        ['Pending Total', data.payment_pending_total],
        ['Failed Total', data.payment_failed_total],
        ['Partial Total', data.payment_partial_total],
      ];
      return rows
        .map(row => row.map(cell => this.escapeCsv(cell)).join(','))
        .join('\n');
    }

    const rows: Array<Array<string | number>> = [
      ['submission_day', 'count'],
      ...data.submissions_by_day.map(item => [item.day, item.count]),
      [''],
      ['payment_day', 'count', 'total'],
      ...data.payments_by_day.map(item => [item.day, item.count, item.total]),
      [''],
      ['payment_status', 'count', 'total_amount'],
      ...data.payment_status_breakdown.map(item => [item.status, item.count, item.total_amount]),
    ];

    return rows
      .map(row => row.map(cell => this.escapeCsv(cell)).join(','))
      .join('\n');
  }

  private async buildPdf(type: 'summary' | 'analytics', data: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const PDFDocument = require('pdfkit');
      const pdf = new PDFDocument({ margin: 24 });
      const chunks: Buffer[] = [];

      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      pdf.fontSize(18).text(`Report: ${type}`, { underline: true });
      pdf.moveDown();

      if (type === 'summary') {
        Object.entries(data).forEach(([key, value]) => {
          if (key !== 'range') {
            pdf.fontSize(12).text(`${key}: ${value}`);
          }
        });
      } else {
        pdf.fontSize(14).text('Submissions by Day');
        pdf.fontSize(10).text(data.submissions_by_day.map(item => `${item.day}: ${item.count}`).join('\n') || 'No data');
        pdf.moveDown();
        pdf.fontSize(14).text('Payments by Day');
        pdf.fontSize(10).text(data.payments_by_day.map(item => `${item.day}: ${item.count} (${item.total})`).join('\n') || 'No data');
        pdf.moveDown();
        pdf.fontSize(14).text('Payment Status Breakdown');
        pdf.fontSize(10).text(data.payment_status_breakdown.map(item => `${item.status}: ${item.count} (${item.total_amount})`).join('\n') || 'No data');
      }

      pdf.end();
    });
  }

  private escapeCsv(value: unknown) {
    const raw = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
}
