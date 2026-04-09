import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Form } from '../../form/entities/form.entity';
import { Submission } from '../../submission/entities/submission.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { Group } from '../../group/entities/group.entity';

@Injectable()
export class ReportService {
  constructor(
    @InjectRepository(Form) private formRepository: Repository<Form>,
    @InjectRepository(Submission) private submissionRepository: Repository<Submission>,
    @InjectRepository(Payment) private paymentRepository: Repository<Payment>,
    @InjectRepository(Contact) private contactRepository: Repository<Contact>,
    @InjectRepository(Group) private groupRepository: Repository<Group>,
  ) {}

  private normalizeDateBoundary(value: string, boundary: 'start' | 'end') {
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

  private parseDateRange(startDate?: string, endDate?: string) {
    const range: { start?: Date; end?: Date } = {};
    if (startDate) {
      range.start = this.normalizeDateBoundary(startDate, 'start');
    }
    if (endDate) {
      range.end = this.normalizeDateBoundary(endDate, 'end');
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
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :paid THEN payment.amount ELSE 0 END)', 'paid_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :pending THEN payment.amount ELSE 0 END)', 'pending_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :failed THEN payment.amount ELSE 0 END)', 'failed_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :partial THEN payment.amount ELSE 0 END)', 'partial_total')
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

    const paymentsByDayDetailed = await this.paymentRepository
      .createQueryBuilder('payment')
      .select("DATE_TRUNC('day', payment.created_at)", 'day')
      .addSelect('UPPER(payment.status)', 'status')
      .addSelect('COUNT(payment.id)', 'count')
      .addSelect('SUM(payment.amount)', 'total')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.created_at BETWEEN :queryStart AND :queryEnd', { queryStart, queryEnd })
      .groupBy('day')
      .addGroupBy('UPPER(payment.status)')
      .orderBy('day', 'ASC')
      .getRawMany();

    const paymentsByDayMap = new Map<string, {
      day: string;
      paid: { count: number; total: number };
      pending: { count: number; total: number };
      failed: { count: number; total: number };
      partial: { count: number; total: number };
    }>();

    paymentsByDayDetailed.forEach(row => {
      const day = row.day.toISOString().slice(0, 10);
      if (!paymentsByDayMap.has(day)) {
        paymentsByDayMap.set(day, {
          day,
          paid: { count: 0, total: 0 },
          pending: { count: 0, total: 0 },
          failed: { count: 0, total: 0 },
          partial: { count: 0, total: 0 },
        });
      }

      const dayData = paymentsByDayMap.get(day);
      if (!dayData) {
        return;
      }

      const status = String(row.status).toLowerCase();
      if (status === 'paid') {
        dayData.paid.count += Number(row.count);
        dayData.paid.total += Number(row.total || 0);
      } else if (status === 'pending') {
        dayData.pending.count += Number(row.count);
        dayData.pending.total += Number(row.total || 0);
      } else if (status === 'failed') {
        dayData.failed.count += Number(row.count);
        dayData.failed.total += Number(row.total || 0);
      } else if (status === 'partial') {
        dayData.partial.count += Number(row.count);
        dayData.partial.total += Number(row.total || 0);
      }
    });

    const paymentStatusBreakdown = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('UPPER(payment.status)', 'status')
      .addSelect('COUNT(payment.id)', 'count')
      .addSelect('SUM(payment.amount)', 'total_amount')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.created_at BETWEEN :queryStart AND :queryEnd', { queryStart, queryEnd })
      .groupBy('UPPER(payment.status)')
      .getRawMany();

    const allStatuses = ['PAID', 'PENDING', 'FAILED', 'PARTIAL'];
    const statusMap = new Map(
      paymentStatusBreakdown.map(row => [
        String(row.status).toUpperCase(),
        {
          status: String(row.status).toUpperCase(),
          count: Number(row.count),
          total_amount: Number(row.total_amount),
        },
      ]),
    );
    const completeBreakdown = allStatuses.map(status => statusMap.get(status) || { status, count: 0, total_amount: 0 });

    return {
      range: {
        start: queryStart.toISOString(),
        end: queryEnd.toISOString(),
      },
      submissions_by_day: submissionsByDay.map(row => ({ day: row.day.toISOString().slice(0, 10), count: Number(row.count) })),
      payments_by_day: Array.from(paymentsByDayMap.values()),
      payment_status_breakdown: completeBreakdown,
    };
  }

  async getFormPerformance(organizationId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    const forms = await this.formRepository.find({
      where: { organization_id: organizationId },
      select: ['id', 'title', 'slug', 'is_active', 'created_at'],
    });

    if (forms.length === 0) {
      return {
        range: {
          start: start?.toISOString() ?? null,
          end: end?.toISOString() ?? null,
        },
        totals: {
          forms: 0,
          submissions: 0,
          payments: 0,
          amount_total: 0,
          paid_amount_total: 0,
        },
        data: [],
      };
    }

    const submissionQuery = this.submissionRepository
      .createQueryBuilder('submission')
      .select('submission.form_id', 'form_id')
      .addSelect('COUNT(submission.id)', 'submissions')
      .where('submission.organization_id = :organizationId', { organizationId });

    if (start) {
      submissionQuery.andWhere('submission.created_at >= :start', { start });
    }
    if (end) {
      submissionQuery.andWhere('submission.created_at <= :end', { end });
    }

    const submissionsByForm = await submissionQuery
      .groupBy('submission.form_id')
      .getRawMany();

    const paymentQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.submission', 'submission')
      .select('submission.form_id', 'form_id')
      .addSelect('COUNT(payment.id)', 'payments')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :paid THEN 1 ELSE 0 END)', 'paid_payments')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :pending THEN 1 ELSE 0 END)', 'pending_payments')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :failed THEN 1 ELSE 0 END)', 'failed_payments')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :partial THEN 1 ELSE 0 END)', 'partial_payments')
      .addSelect('SUM(payment.amount)', 'amount_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :paid THEN payment.amount ELSE 0 END)', 'paid_amount_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :pending THEN payment.amount ELSE 0 END)', 'pending_amount_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :failed THEN payment.amount ELSE 0 END)', 'failed_amount_total')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :partial THEN payment.amount ELSE 0 END)', 'partial_amount_total')
      .where('payment.organization_id = :organizationId', { organizationId })
      .setParameters({ paid: 'PAID', pending: 'PENDING', failed: 'FAILED', partial: 'PARTIAL' });

    if (start) {
      paymentQuery.andWhere('payment.created_at >= :start', { start });
    }
    if (end) {
      paymentQuery.andWhere('payment.created_at <= :end', { end });
    }

    const paymentsByForm = await paymentQuery
      .groupBy('submission.form_id')
      .getRawMany();

    const submissionMap = new Map(submissionsByForm.map(row => [row.form_id, Number(row.submissions)]));
    const paymentMap = new Map(paymentsByForm.map(row => [row.form_id, row]));

    const data = forms.map(form => {
      const paymentsRow = paymentMap.get(form.id) ?? {} as any;
      const submissions = submissionMap.get(form.id) ?? 0;
      const payments = Number(paymentsRow.payments || 0);
      const paidPayments = Number(paymentsRow.paid_payments || 0);
      const pendingPayments = Number(paymentsRow.pending_payments || 0);
      const failedPayments = Number(paymentsRow.failed_payments || 0);
      const partialPayments = Number(paymentsRow.partial_payments || 0);
      const amountTotal = Number(paymentsRow.amount_total || 0);
      const paidAmountTotal = Number(paymentsRow.paid_amount_total || 0);
      const pendingAmountTotal = Number(paymentsRow.pending_amount_total || 0);
      const failedAmountTotal = Number(paymentsRow.failed_amount_total || 0);
      const partialAmountTotal = Number(paymentsRow.partial_amount_total || 0);

      return {
        form_id: form.id,
        title: form.title,
        slug: form.slug,
        is_active: form.is_active,
        created_at: form.created_at.toISOString(),
        submissions,
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
        completion_rate: submissions > 0 ? Number(((paidPayments / submissions) * 100).toFixed(2)) : 0,
        collection_rate: amountTotal > 0 ? Number(((paidAmountTotal / amountTotal) * 100).toFixed(2)) : 0,
      };
    });

    const totals = data.reduce(
      (acc, item) => ({
        forms: acc.forms + 1,
        submissions: acc.submissions + item.submissions,
        payments: acc.payments + item.payments,
        amount_total: acc.amount_total + item.amount_total,
        paid_amount_total: acc.paid_amount_total + item.paid_amount_total,
      }),
      { forms: 0, submissions: 0, payments: 0, amount_total: 0, paid_amount_total: 0 },
    );

    return {
      range: {
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
      },
      totals,
      data,
    };
  }

  async getFormSubmissionSummary(organizationId: string, formId: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    const form = await this.formRepository.findOne({
      where: { id: formId, organization_id: organizationId },
      relations: ['fields'],
    });

    if (!form) {
      throw new BadRequestException('Form not found');
    }

    const fields = [...(form.fields ?? [])].sort((a, b) => a.order_index - b.order_index);
    const fieldLabels = new Set(fields.map(field => field.label));

    const submissionQuery = this.submissionRepository
      .createQueryBuilder('submission')
      .leftJoinAndSelect('submission.contact', 'contact')
      .where('submission.organization_id = :organizationId', { organizationId })
      .andWhere('submission.form_id = :formId', { formId });

    if (start) {
      submissionQuery.andWhere('submission.created_at >= :start', { start });
    }
    if (end) {
      submissionQuery.andWhere('submission.created_at <= :end', { end });
    }

    const submissions = await submissionQuery
      .orderBy('submission.created_at', 'DESC')
      .getMany();

    const paymentQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('submission.form_id = :formId', { formId });

    if (start) {
      paymentQuery.andWhere('payment.created_at >= :start', { start });
    }
    if (end) {
      paymentQuery.andWhere('payment.created_at <= :end', { end });
    }

    const payments = await paymentQuery.getMany();

    const submissionSources = submissions.reduce(
      (acc, submission) => {
        if (submission.contact_id) {
          acc.registered_contacts += 1;
        } else {
          acc.public_users += 1;
        }
        return acc;
      },
      { registered_contacts: 0, public_users: 0 },
    );

    const paymentSources = {
      registered_contacts: { count: 0, amount_total: 0, paid_amount_total: 0 },
      public_users: { count: 0, amount_total: 0, paid_amount_total: 0 },
    };

    const paymentBreakdownMap = new Map(
      ['PAID', 'PENDING', 'FAILED', 'PARTIAL'].map(status => [
        status,
        { status, count: 0, amount_total: 0 },
      ]),
    );

    for (const payment of payments) {
      const status = String(payment.status || 'PENDING').toUpperCase();
      const amount = Number(payment.amount || 0);
      const sourceKey = payment.submission?.contact_id ? 'registered_contacts' : 'public_users';
      const existing = paymentBreakdownMap.get(status) ?? { status, count: 0, amount_total: 0 };

      existing.count += 1;
      existing.amount_total += amount;
      paymentBreakdownMap.set(status, existing);

      paymentSources[sourceKey].count += 1;
      paymentSources[sourceKey].amount_total += amount;
      if (status === 'PAID') {
        paymentSources[sourceKey].paid_amount_total += amount;
      }
    }

    const fieldSummaries = fields.map(field =>
      this.buildFieldSummary(field.label, field.type, field.required, field.options, field.order_index, submissions.map(submission => submission.data?.[field.label])),
    ).map((summary, index) => ({
      field_id: fields[index].id,
      ...summary,
    }));

    const unmappedFieldLabels = Array.from(
      submissions.reduce((labels, submission) => {
        Object.keys(submission.data || {}).forEach(label => {
          if (!fieldLabels.has(label)) {
            labels.add(label);
          }
        });
        return labels;
      }, new Set<string>()),
    ).sort((a, b) => a.localeCompare(b));

    const unmappedFields = unmappedFieldLabels.map(label => ({
      field_id: null,
      ...this.buildFieldSummary(label, 'UNKNOWN', false, null, null, submissions.map(submission => submission.data?.[label])),
    }));

    const paidAmountTotal = paymentBreakdownMap.get('PAID')?.amount_total ?? 0;
    const pendingAmountTotal = paymentBreakdownMap.get('PENDING')?.amount_total ?? 0;
    const failedAmountTotal = paymentBreakdownMap.get('FAILED')?.amount_total ?? 0;
    const partialAmountTotal = paymentBreakdownMap.get('PARTIAL')?.amount_total ?? 0;

    return {
      range: {
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
      },
      form: {
        id: form.id,
        title: form.title,
        slug: form.slug,
        category: form.category,
        payment_type: form.payment_type,
        amount: form.amount === null || form.amount === undefined ? null : Number(form.amount),
        access_mode: form.access_mode,
        is_active: form.is_active,
        created_at: form.created_at.toISOString(),
      },
      totals: {
        submissions: submissions.length,
        registered_contact_submissions: submissionSources.registered_contacts,
        public_submissions: submissionSources.public_users,
        payments: payments.length,
        amount_total: payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
        paid_amount_total: paidAmountTotal,
        pending_amount_total: pendingAmountTotal,
        failed_amount_total: failedAmountTotal,
        partial_amount_total: partialAmountTotal,
      },
      payment_breakdown: Array.from(paymentBreakdownMap.values()),
      payment_sources: paymentSources,
      field_summaries: fieldSummaries,
      unmapped_fields: unmappedFields,
      latest_submission_at: submissions[0]?.created_at?.toISOString() ?? null,
      latest_payment_at: payments
        .slice()
        .sort((left, right) => right.created_at.getTime() - left.created_at.getTime())[0]?.created_at?.toISOString() ?? null,
    };
  }

  private buildFieldSummary(
    label: string,
    type: Form['fields'][number]['type'] | 'UNKNOWN',
    required: boolean,
    options: string[] | null,
    orderIndex: number | null,
    rawValues: unknown[],
  ) {
    const normalizedValues = rawValues
      .map(value => this.normalizeFieldValue(value))
      .filter((value): value is string => value !== null);

    const counts = new Map<string, number>();
    for (const value of normalizedValues) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }

    const topResponses = Array.from(counts.entries())
      .sort((left, right) => {
        if (right[1] !== left[1]) {
          return right[1] - left[1];
        }
        return left[0].localeCompare(right[0]);
      })
      .slice(0, 10)
      .map(([value, count]) => ({ value, count }));

    const numericValues = type === 'NUMBER'
      ? normalizedValues
        .map(value => Number(value))
        .filter(value => Number.isFinite(value))
      : [];

    return {
      label,
      type,
      required,
      options,
      order_index: orderIndex,
      response_count: normalizedValues.length,
      blank_count: rawValues.length - normalizedValues.length,
      unique_response_count: counts.size,
      top_responses: topResponses,
      numeric_summary: numericValues.length > 0
        ? {
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          average: Number((numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length).toFixed(2)),
          sum: Number(numericValues.reduce((sum, value) => sum + value, 0).toFixed(2)),
        }
        : null,
    };
  }

  private normalizeFieldValue(value: unknown): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    if (Array.isArray(value)) {
      return value.length > 0 ? JSON.stringify(value) : null;
    }

    if (typeof value === 'object') {
      return Object.keys(value as Record<string, unknown>).length > 0 ? JSON.stringify(value) : null;
    }

    return String(value);
  }

  async getGroupContributions(organizationId: string, formId?: string, startDate?: string, endDate?: string) {
    const { start, end } = this.parseDateRange(startDate, endDate);

    // Get form details if specified
    let formDetails: Form | null = null;
    if (formId) {
      formDetails = await this.formRepository.findOne({
        where: { id: formId, organization_id: organizationId },
        select: ['id', 'title', 'amount', 'payment_type'],
      });
      if (!formDetails) {
        throw new BadRequestException('Form not found');
      }
    }

    // Get all groups and their subgroup hierarchies
    const allGroups = await this.groupRepository.find({
      where: { organization_id: organizationId },
      select: ['id', 'name', 'parent_group_id'],
    });

    // Create a map of group to all its subgroup IDs (including itself)
    const groupHierarchyMap = new Map<string, string[]>();
    for (const group of allGroups) {
      const allSubgroupIds = await this.getAllSubgroupIdsForGroup(organizationId, group.id);
      allSubgroupIds.push(group.id); // Include the group itself
      groupHierarchyMap.set(group.id, allSubgroupIds);
    }

    // Query for group contributions using the hierarchy
    const contributionsQuery = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.submission', 'submission')
      .innerJoin('submission.contact', 'contact')
      .innerJoin('contact.groups', 'group')
      .select('group.id', 'group_id')
      .addSelect('group.name', 'group_name')
      .addSelect('COUNT(DISTINCT contact.id)', 'contact_count')
      .addSelect('COUNT(DISTINCT submission.id)', 'submission_count')
      .addSelect('COUNT(payment.id)', 'payment_count')
      .addSelect('SUM(payment.amount)', 'total_amount')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :paid THEN payment.amount ELSE 0 END)', 'paid_amount')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :pending THEN payment.amount ELSE 0 END)', 'pending_amount')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :failed THEN payment.amount ELSE 0 END)', 'failed_amount')
      .addSelect('SUM(CASE WHEN UPPER(payment.status) = :partial THEN payment.amount ELSE 0 END)', 'partial_amount')
      .where('payment.organization_id = :organizationId', { organizationId })
      .setParameters({ paid: 'PAID', pending: 'PENDING', failed: 'FAILED', partial: 'PARTIAL' });

    if (formId) {
      contributionsQuery.andWhere('submission.form_id = :formId', { formId });
    }

    if (start) {
      contributionsQuery.andWhere('payment.created_at >= :start', { start });
    }
    if (end) {
      contributionsQuery.andWhere('payment.created_at <= :end', { end });
    }

    const contributions = await contributionsQuery
      .groupBy('group.id')
      .addGroupBy('group.name')
      .orderBy('total_amount', 'DESC')
      .getRawMany();

    // Calculate deficits for fixed amount forms
    const result = contributions.map(row => {
      const totalAmount = Number(row.total_amount || 0);
      const paidAmount = Number(row.paid_amount || 0);
      const contactCount = Number(row.contact_count || 0);

      let deficit = 0;
      let expectedTotal = 0;

      if (formDetails && formDetails.payment_type === 'FIXED' && formDetails.amount) {
        expectedTotal = contactCount * formDetails.amount;
        deficit = Math.max(0, expectedTotal - paidAmount);
      }

      return {
        group_id: row.group_id,
        group_name: row.group_name,
        contact_count: contactCount,
        submission_count: Number(row.submission_count || 0),
        payment_count: Number(row.payment_count || 0),
        total_amount: totalAmount,
        paid_amount: paidAmount,
        pending_amount: Number(row.pending_amount || 0),
        failed_amount: Number(row.failed_amount || 0),
        partial_amount: Number(row.partial_amount || 0),
        expected_total: expectedTotal,
        deficit: deficit,
        collection_rate: expectedTotal > 0 ? Number(((paidAmount / expectedTotal) * 100).toFixed(2)) : 0,
      };
    });

    return {
      form: formDetails ? {
        id: formDetails.id,
        title: formDetails.title,
        amount: formDetails.amount,
        payment_type: formDetails.payment_type,
      } : null,
      range: {
        start: start?.toISOString() ?? null,
        end: end?.toISOString() ?? null,
      },
      groups: result,
      summary: result.reduce(
        (acc, group) => ({
          total_groups: acc.total_groups + 1,
          total_contacts: acc.total_contacts + group.contact_count,
          total_submissions: acc.total_submissions + group.submission_count,
          total_payments: acc.total_payments + group.payment_count,
          total_amount: acc.total_amount + group.total_amount,
          total_paid: acc.total_paid + group.paid_amount,
          total_expected: acc.total_expected + group.expected_total,
          total_deficit: acc.total_deficit + group.deficit,
        }),
        {
          total_groups: 0,
          total_contacts: 0,
          total_submissions: 0,
          total_payments: 0,
          total_amount: 0,
          total_paid: 0,
          total_expected: 0,
          total_deficit: 0,
        },
      ),
    };
  }

  private async getAllSubgroupIdsForGroup(organizationId: string, parentGroupId: string): Promise<string[]> {
    const subgroupIds: string[] = [];

    const subgroups = await this.groupRepository.find({
      where: { parent_group_id: parentGroupId, organization_id: organizationId },
      select: ['id'],
    });

    for (const subgroup of subgroups) {
      subgroupIds.push(subgroup.id);
      // Recursively get subgroups of subgroups
      const nestedSubgroupIds = await this.getAllSubgroupIdsForGroup(organizationId, subgroup.id);
      subgroupIds.push(...nestedSubgroupIds);
    }

    return subgroupIds;
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
      ['payment_day', 'paid_count', 'paid_total', 'pending_count', 'pending_total', 'failed_count', 'failed_total', 'partial_count', 'partial_total'],
      ...data.payments_by_day.map(item => [
        item.day,
        item.paid?.count || 0,
        item.paid?.total || 0,
        item.pending?.count || 0,
        item.pending?.total || 0,
        item.failed?.count || 0,
        item.failed?.total || 0,
        item.partial?.count || 0,
        item.partial?.total || 0,
      ]),
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
        pdf.fontSize(10).text(
          data.payments_by_day.map(item => (
            `${item.day}: paid ${item.paid?.count || 0} (${item.paid?.total || 0}), `
            + `pending ${item.pending?.count || 0} (${item.pending?.total || 0}), `
            + `failed ${item.failed?.count || 0} (${item.failed?.total || 0}), `
            + `partial ${item.partial?.count || 0} (${item.partial?.total || 0})`
          )).join('\n') || 'No data',
        );
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
