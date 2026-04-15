import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomUUID } from 'crypto';
import { In, LessThan, Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { CheckoutSession, CheckoutSessionStatus } from './entities/checkout-session.entity';
import { PaymentRecoveryCandidate } from './entities/payment-recovery-candidate.entity';
import { PaymentRecoveryEvent } from './entities/payment-recovery-event.entity';
import { Payment } from '../payment/entities/payment.entity';
import { InstallmentPlan } from './entities/installment-plan.entity';
import { InstallmentPlanItem } from './entities/installment-plan-item.entity';
import { ContactInstallmentAccount } from './entities/contact-installment-account.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ReconciliationRun } from './entities/reconciliation-run.entity';
import { ReconciliationException } from './entities/reconciliation-exception.entity';
import { IntegrationEndpoint } from './entities/integration-endpoint.entity';
import { IntegrationDelivery } from './entities/integration-delivery.entity';
import { Partner } from './entities/partner.entity';
import { PartnerTenant } from './entities/partner-tenant.entity';
import { DunningCampaign } from './entities/dunning-campaign.entity';
import { DunningRun } from './entities/dunning-run.entity';
import { ArrearsSnapshot } from './entities/arrears-snapshot.entity';
import { ComplianceExportJob } from './entities/compliance-export-job.entity';
import { ComplianceExportArtifact } from './entities/compliance-export-artifact.entity';

const MARKET_FLAG_KEYS = {
  checkoutV2: 'checkout_v2_enabled',
  abandonedRecovery: 'abandoned_recovery_enabled',
  installments: 'installments_enabled',
  arrearsDunning: 'arrears_dunning_enabled',
  reconciliationWorkspace: 'reconciliation_workspace_enabled',
  integrations: 'integrations_enabled',
  partnerToolkit: 'partner_toolkit_enabled',
  complianceExportPack: 'compliance_export_pack_enabled',
} as const;

@Injectable()
export class MarketReadinessService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(CheckoutSession)
    private checkoutSessionRepository: Repository<CheckoutSession>,
    @InjectRepository(PaymentRecoveryCandidate)
    private recoveryCandidateRepository: Repository<PaymentRecoveryCandidate>,
    @InjectRepository(PaymentRecoveryEvent)
    private recoveryEventRepository: Repository<PaymentRecoveryEvent>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(InstallmentPlan)
    private installmentPlanRepository: Repository<InstallmentPlan>,
    @InjectRepository(InstallmentPlanItem)
    private installmentPlanItemRepository: Repository<InstallmentPlanItem>,
    @InjectRepository(ContactInstallmentAccount)
    private contactInstallmentAccountRepository: Repository<ContactInstallmentAccount>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(ReconciliationRun)
    private reconciliationRunRepository: Repository<ReconciliationRun>,
    @InjectRepository(ReconciliationException)
    private reconciliationExceptionRepository: Repository<ReconciliationException>,
    @InjectRepository(IntegrationEndpoint)
    private integrationEndpointRepository: Repository<IntegrationEndpoint>,
    @InjectRepository(IntegrationDelivery)
    private integrationDeliveryRepository: Repository<IntegrationDelivery>,
    @InjectRepository(Partner)
    private partnerRepository: Repository<Partner>,
    @InjectRepository(PartnerTenant)
    private partnerTenantRepository: Repository<PartnerTenant>,
    @InjectRepository(DunningCampaign)
    private dunningCampaignRepository: Repository<DunningCampaign>,
    @InjectRepository(DunningRun)
    private dunningRunRepository: Repository<DunningRun>,
    @InjectRepository(ArrearsSnapshot)
    private arrearsSnapshotRepository: Repository<ArrearsSnapshot>,
    @InjectRepository(ComplianceExportJob)
    private complianceExportJobRepository: Repository<ComplianceExportJob>,
    @InjectRepository(ComplianceExportArtifact)
    private complianceExportArtifactRepository: Repository<ComplianceExportArtifact>,
  ) {}

  async getFlags(organizationId: string) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'market_readiness_flags'],
    });

    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    return this.normalizeFlags(org.market_readiness_flags || {});
  }

  async updateFlags(organizationId: string, flags: Record<string, boolean>) {
    const current = await this.getFlags(organizationId);
    const next = {
      ...current,
      ...this.normalizeFlags(flags),
    };

    await this.organizationRepository.update(organizationId, {
      market_readiness_flags: next,
    });

    return next;
  }

  async createCheckoutSession(
    organizationId: string,
    payload: { form_id?: string; contact_id?: string; reference?: string },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.checkoutV2);

    const session = await this.checkoutSessionRepository.save(
      this.checkoutSessionRepository.create({
        organization_id: organizationId,
        form_id: payload.form_id || null,
        contact_id: payload.contact_id || null,
        reference: payload.reference || null,
        status: 'STARTED',
        completed_at: null,
      }),
    );

    return session;
  }

  async updateCheckoutSession(
    organizationId: string,
    sessionId: string,
    status: CheckoutSessionStatus = 'STARTED',
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.checkoutV2);

    const session = await this.checkoutSessionRepository.findOne({
      where: { id: sessionId, organization_id: organizationId },
    });
    if (!session) {
      throw new NotFoundException('Checkout session not found');
    }

    session.status = status;
    session.completed_at = status === 'COMPLETED' ? new Date() : session.completed_at;
    const saved = await this.checkoutSessionRepository.save(session);

    return saved;
  }

  async getCheckoutMetrics(organizationId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.checkoutV2);

    const [sessions_started, sessions_completed, sessions_abandoned] = await Promise.all([
      this.checkoutSessionRepository.count({ where: { organization_id: organizationId } }),
      this.checkoutSessionRepository.count({ where: { organization_id: organizationId, status: 'COMPLETED' } }),
      this.checkoutSessionRepository.count({ where: { organization_id: organizationId, status: 'ABANDONED' } }),
    ]);

    const conversion_rate = sessions_started > 0
      ? Number(((sessions_completed / sessions_started) * 100).toFixed(2))
      : 0;

    return {
      organization_id: organizationId,
      sessions_started,
      sessions_completed,
      sessions_abandoned,
      conversion_rate,
    };
  }

  async listRecoveryCandidates(organizationId: string, page = 1, limit = 20) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.abandonedRecovery);

    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const [data, total] = await this.recoveryCandidateRepository.findAndCount({
      where: { organization_id: organizationId },
      order: { detected_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
      organization_id: organizationId,
    };
  }

  async notifyRecoveryCandidate(organizationId: string, candidateId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.abandonedRecovery);

    const candidate = await this.recoveryCandidateRepository.findOne({
      where: { id: candidateId, organization_id: organizationId },
    });
    if (!candidate) {
      throw new NotFoundException('Recovery candidate not found');
    }

    candidate.status = 'QUEUED';
    candidate.last_notified_at = new Date();
    candidate.attempt_count = Number(candidate.attempt_count || 0) + 1;
    const saved = await this.recoveryCandidateRepository.save(candidate);

    await this.recoveryEventRepository.save(
      this.recoveryEventRepository.create({
        organization_id: organizationId,
        candidate_id: saved.id,
        event_type: 'QUEUED',
        payload: {
          source: 'manual_notify',
          attempt_count: saved.attempt_count,
        },
      }),
    );

    await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.recovery.candidate.notified', {
      candidate_id: saved.id,
      payment_id: saved.payment_id,
      reference: saved.reference,
      status: saved.status,
      attempt_count: saved.attempt_count,
      notified_at: saved.last_notified_at,
    });

    return {
      success: true,
      organization_id: organizationId,
      candidate_id: candidateId,
      status: saved.status,
    };
  }

  async runRecovery(organizationId: string, dryRun = false) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.abandonedRecovery);

    const cutoff = new Date(Date.now() - 1000 * 60 * 60 * 24);
    const pendingPayments = await this.paymentRepository.find({
      where: {
        organization_id: organizationId,
        status: 'PENDING',
        created_at: LessThan(cutoff),
      },
      select: ['id', 'reference', 'created_at'],
      take: 200,
      order: { created_at: 'ASC' },
    });

    if (pendingPayments.length === 0) {
      return {
        success: true,
        organization_id: organizationId,
        dry_run: dryRun,
        scanned: 0,
        created: 0,
        queued_at: new Date().toISOString(),
      };
    }

    const paymentIds = pendingPayments.map(payment => payment.id);
    const existingCandidates = await this.recoveryCandidateRepository.find({
      where: {
        organization_id: organizationId,
        payment_id: In(paymentIds),
        status: In(['OPEN', 'QUEUED', 'NOTIFIED']),
      },
      select: ['payment_id'],
    });

    const existingPaymentIds = new Set(existingCandidates.map(item => item.payment_id));
    const missingCandidates = pendingPayments.filter(payment => !existingPaymentIds.has(payment.id));

    if (!dryRun && missingCandidates.length > 0) {
      const created = await this.recoveryCandidateRepository.save(
        missingCandidates.map(payment => this.recoveryCandidateRepository.create({
          organization_id: organizationId,
          payment_id: payment.id,
          reference: payment.reference,
          status: 'OPEN',
          metadata: {
            source: 'scheduled_run',
            payment_created_at: payment.created_at,
          },
        })),
      );

      await this.recoveryEventRepository.save(
        created.map(candidate => this.recoveryEventRepository.create({
          organization_id: organizationId,
          candidate_id: candidate.id,
          event_type: 'DETECTED',
          payload: {
            source: 'scheduled_run',
            payment_id: candidate.payment_id,
            reference: candidate.reference,
          },
        })),
      );
    }

    await this.recoveryEventRepository.save(
      this.recoveryEventRepository.create({
        organization_id: organizationId,
        candidate_id: null,
        event_type: 'RUN',
        payload: {
          dry_run: dryRun,
          scanned: pendingPayments.length,
          would_create: missingCandidates.length,
        },
      }),
    );

    await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.recovery.run.completed', {
      dry_run: dryRun,
      scanned: pendingPayments.length,
      created: dryRun ? 0 : missingCandidates.length,
      would_create: dryRun ? missingCandidates.length : 0,
      queued_at: new Date().toISOString(),
    });

    return {
      success: true,
      organization_id: organizationId,
      dry_run: dryRun,
      scanned: pendingPayments.length,
      created: dryRun ? 0 : missingCandidates.length,
      would_create: dryRun ? missingCandidates.length : 0,
      queued_at: new Date().toISOString(),
    };
  }

  async createInstallmentPlan(
    organizationId: string,
    payload: {
      form_id: string;
      name: string;
      currency?: string;
      total_amount: number;
      active?: boolean;
      items: Array<{
        label: string;
        amount: number;
        due_date: string;
        penalty_rule?: Record<string, unknown>;
        order_index?: number;
      }>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const form = await this.formRepository.findOne({
      where: { id: payload.form_id, organization_id: organizationId },
      select: ['id', 'organization_id'],
    });
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const items = Array.isArray(payload.items) ? payload.items : [];
    if (!items.length) {
      throw new ForbiddenException('Installment plan requires at least one item');
    }

    const plan = await this.installmentPlanRepository.save(
      this.installmentPlanRepository.create({
        organization_id: organizationId,
        form_id: payload.form_id,
        name: payload.name,
        currency: payload.currency || 'NGN',
        total_amount: payload.total_amount,
        active: payload.active ?? true,
      }),
    );

    const planItems = await this.installmentPlanItemRepository.save(
      items.map((item, index) => this.installmentPlanItemRepository.create({
        plan_id: plan.id,
        label: item.label,
        amount: item.amount,
        due_date: item.due_date,
        penalty_rule: item.penalty_rule || null,
        order_index: item.order_index ?? index,
      })),
    );

    return {
      ...plan,
      items: planItems,
    };
  }

  async listInstallmentPlans(organizationId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const plans = await this.installmentPlanRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });

    return plans;
  }

  async getInstallmentPlan(organizationId: string, planId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const plan = await this.installmentPlanRepository.findOne({
      where: { id: planId, organization_id: organizationId },
    });
    if (!plan) {
      throw new NotFoundException('Installment plan not found');
    }

    const items = await this.installmentPlanItemRepository.find({
      where: { plan_id: plan.id },
      order: { order_index: 'ASC' },
    });

    return {
      ...plan,
      items,
    };
  }

  async updateInstallmentPlan(
    organizationId: string,
    planId: string,
    payload: {
      name?: string;
      currency?: string;
      total_amount?: number;
      active?: boolean;
      items?: Array<{
        label: string;
        amount: number;
        due_date: string;
        penalty_rule?: Record<string, unknown>;
        order_index?: number;
      }>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const plan = await this.installmentPlanRepository.findOne({
      where: { id: planId, organization_id: organizationId },
    });
    if (!plan) {
      throw new NotFoundException('Installment plan not found');
    }

    Object.assign(plan, {
      name: payload.name ?? plan.name,
      currency: payload.currency ?? plan.currency,
      total_amount: payload.total_amount ?? plan.total_amount,
      active: payload.active ?? plan.active,
    });
    const savedPlan = await this.installmentPlanRepository.save(plan);

    if (Array.isArray(payload.items)) {
      await this.installmentPlanItemRepository.delete({ plan_id: plan.id });
      await this.installmentPlanItemRepository.save(
        payload.items.map((item, index) => this.installmentPlanItemRepository.create({
          plan_id: plan.id,
          label: item.label,
          amount: item.amount,
          due_date: item.due_date,
          penalty_rule: item.penalty_rule || null,
          order_index: item.order_index ?? index,
        })),
      );
    }

    return this.getInstallmentPlan(organizationId, savedPlan.id);
  }

  async assignInstallmentPlanContacts(organizationId: string, planId: string, contactIds: string[]) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const plan = await this.installmentPlanRepository.findOne({
      where: { id: planId, organization_id: organizationId },
    });
    if (!plan) {
      throw new NotFoundException('Installment plan not found');
    }

    const uniqueContactIds = Array.from(new Set((contactIds || []).filter(Boolean)));
    if (!uniqueContactIds.length) {
      return { success: true, assigned: 0 };
    }

    const contacts = await this.contactRepository.find({
      where: {
        id: In(uniqueContactIds),
        organization_id: organizationId,
      },
      select: ['id'],
    });
    const validContactIds = new Set(contacts.map(contact => contact.id));

    const existing = await this.contactInstallmentAccountRepository.find({
      where: {
        organization_id: organizationId,
        plan_id: planId,
        contact_id: In(Array.from(validContactIds)),
      },
      select: ['contact_id'],
    });
    const existingContactIds = new Set(existing.map(item => item.contact_id));

    const toCreate = Array.from(validContactIds)
      .filter(contactId => !existingContactIds.has(contactId))
      .map(contactId => this.contactInstallmentAccountRepository.create({
        organization_id: organizationId,
        contact_id: contactId,
        plan_id: planId,
        outstanding_amount: plan.total_amount,
        status: 'ACTIVE',
      }));

    if (toCreate.length > 0) {
      await this.contactInstallmentAccountRepository.save(toCreate);
    }

    return {
      success: true,
      requested: uniqueContactIds.length,
      valid_contacts: validContactIds.size,
      assigned: toCreate.length,
      skipped_existing: existingContactIds.size,
    };
  }

  async listInstallmentAccounts(organizationId: string, planId?: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.installments);

    const where = planId
      ? { organization_id: organizationId, plan_id: planId }
      : { organization_id: organizationId };

    const data = await this.contactInstallmentAccountRepository.find({
      where,
      order: { created_at: 'DESC' },
      take: 500,
    });

    return data;
  }

  async createReconciliationRun(
    organizationId: string,
    payload: { period_start?: string; period_end?: string },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.reconciliationWorkspace);

    const today = new Date();
    const defaultEnd = today.toISOString().slice(0, 10);
    const defaultStartDate = new Date(today);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const defaultStart = defaultStartDate.toISOString().slice(0, 10);

    const periodStart = payload.period_start || defaultStart;
    const periodEnd = payload.period_end || defaultEnd;

    const run = await this.reconciliationRunRepository.save(
      this.reconciliationRunRepository.create({
        organization_id: organizationId,
        period_start: periodStart,
        period_end: periodEnd,
        status: 'PROCESSING',
        summary: null,
      }),
    );

    const periodStartDate = new Date(`${periodStart}T00:00:00.000Z`);
    const periodEndDate = new Date(`${periodEnd}T23:59:59.999Z`);

    const payments = await this.paymentRepository
      .createQueryBuilder('payment')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.created_at >= :start', { start: periodStartDate.toISOString() })
      .andWhere('payment.created_at <= :end', { end: periodEndDate.toISOString() })
      .select([
        'payment.id',
        'payment.reference',
        'payment.status',
        'payment.amount',
        'payment.total_amount',
        'payment.amount_paid',
        'payment.balance_due',
        'payment.created_at',
      ])
      .getMany();

    const staleCutoff = new Date();
    staleCutoff.setHours(staleCutoff.getHours() - 24);

    const exceptionsToCreate: ReconciliationException[] = [];

    for (const payment of payments) {
      const balanceDue = Number(payment.balance_due ?? 0);
      const amountPaid = Number(payment.amount_paid ?? 0);

      if (payment.status === 'PAID' && balanceDue > 0) {
        exceptionsToCreate.push(this.reconciliationExceptionRepository.create({
          organization_id: organizationId,
          run_id: run.id,
          payment_id: payment.id,
          reference: payment.reference,
          type: 'STATUS_BALANCE_MISMATCH',
          severity: 'HIGH',
          status: 'OPEN',
          details: {
            status: payment.status,
            amount_paid: amountPaid,
            balance_due: balanceDue,
            message: 'Payment marked PAID while balance_due is greater than zero',
          },
        }));
      }

      if (payment.status === 'PARTIAL' && balanceDue <= 0) {
        exceptionsToCreate.push(this.reconciliationExceptionRepository.create({
          organization_id: organizationId,
          run_id: run.id,
          payment_id: payment.id,
          reference: payment.reference,
          type: 'STATUS_BALANCE_MISMATCH',
          severity: 'MEDIUM',
          status: 'OPEN',
          details: {
            status: payment.status,
            amount_paid: amountPaid,
            balance_due: balanceDue,
            message: 'Payment marked PARTIAL with zero balance_due',
          },
        }));
      }

      if (payment.status === 'PENDING' && payment.created_at < staleCutoff) {
        exceptionsToCreate.push(this.reconciliationExceptionRepository.create({
          organization_id: organizationId,
          run_id: run.id,
          payment_id: payment.id,
          reference: payment.reference,
          type: 'STALE_PENDING',
          severity: 'MEDIUM',
          status: 'OPEN',
          details: {
            status: payment.status,
            created_at: payment.created_at,
            message: 'Pending payment older than 24 hours',
          },
        }));
      }
    }

    if (exceptionsToCreate.length > 0) {
      await this.reconciliationExceptionRepository.save(exceptionsToCreate);
    }

    run.status = 'COMPLETED';
    run.summary = {
      scanned_payments: payments.length,
      exceptions_found: exceptionsToCreate.length,
      period_start: periodStart,
      period_end: periodEnd,
    };

    const savedRun = await this.reconciliationRunRepository.save(run);

    await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.reconciliation.run.completed', {
      run_id: savedRun.id,
      period_start: periodStart,
      period_end: periodEnd,
      scanned_payments: payments.length,
      exceptions_found: exceptionsToCreate.length,
    });

    return savedRun;
  }

  async listReconciliationRuns(organizationId: string, page = 1, limit = 20) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.reconciliationWorkspace);

    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const [data, total] = await this.reconciliationRunRepository.findAndCount({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async listReconciliationExceptions(organizationId: string, runId: string, page = 1, limit = 20) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.reconciliationWorkspace);

    const run = await this.reconciliationRunRepository.findOne({
      where: { id: runId, organization_id: organizationId },
      select: ['id'],
    });
    if (!run) {
      throw new NotFoundException('Reconciliation run not found');
    }

    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const [data, total] = await this.reconciliationExceptionRepository.findAndCount({
      where: { organization_id: organizationId, run_id: runId },
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async updateReconciliationException(
    organizationId: string,
    exceptionId: string,
    payload: { status: 'OPEN' | 'RESOLVED' | 'IGNORED'; resolution_note?: string },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.reconciliationWorkspace);

    const exception = await this.reconciliationExceptionRepository.findOne({
      where: { id: exceptionId, organization_id: organizationId },
    });
    if (!exception) {
      throw new NotFoundException('Reconciliation exception not found');
    }

    exception.status = payload.status;
    if (payload.resolution_note) {
      exception.details = {
        ...(exception.details || {}),
        resolution_note: payload.resolution_note,
      };
    }

    return this.reconciliationExceptionRepository.save(exception);
  }

  async createIntegrationEndpoint(
    organizationId: string,
    payload: {
      type: 'WEBHOOK' | 'SHEETS';
      target: string;
      secret?: string;
      active?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.integrations);

    const entity = this.integrationEndpointRepository.create({
      organization_id: organizationId,
      type: payload.type,
      target: payload.target,
      secret: payload.secret || randomUUID(),
      active: payload.active ?? true,
      config: payload.config || null,
    });

    const saved = await this.integrationEndpointRepository.save(entity);
    return this.sanitizeIntegrationEndpoint(saved);
  }

  async listIntegrationEndpoints(organizationId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.integrations);

    const endpoints = await this.integrationEndpointRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });

    return endpoints.map((endpoint) => this.sanitizeIntegrationEndpoint(endpoint));
  }

  async updateIntegrationEndpoint(
    organizationId: string,
    endpointId: string,
    payload: {
      target?: string;
      secret?: string;
      active?: boolean;
      config?: Record<string, unknown>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.integrations);

    const endpoint = await this.integrationEndpointRepository.findOne({
      where: { id: endpointId, organization_id: organizationId },
    });

    if (!endpoint) {
      throw new NotFoundException('Integration endpoint not found');
    }

    endpoint.target = payload.target ?? endpoint.target;
    endpoint.secret = payload.secret ?? endpoint.secret;
    endpoint.active = typeof payload.active === 'boolean' ? payload.active : endpoint.active;
    if (payload.config !== undefined) {
      endpoint.config = payload.config;
    }

    const saved = await this.integrationEndpointRepository.save(endpoint);
    return this.sanitizeIntegrationEndpoint(saved);
  }

  async listIntegrationDeliveries(
    organizationId: string,
    page = 1,
    limit = 20,
    endpointId?: string,
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.integrations);

    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const where = endpointId
      ? { organization_id: organizationId, endpoint_id: endpointId }
      : { organization_id: organizationId };

    const [data, total] = await this.integrationDeliveryRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async createPartner(
    organizationId: string,
    payload: {
      name: string;
      status?: 'ACTIVE' | 'INACTIVE';
      config?: Record<string, unknown>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.partnerToolkit);

    const partner = await this.partnerRepository.save(
      this.partnerRepository.create({
        organization_id: organizationId,
        name: payload.name,
        status: payload.status || 'ACTIVE',
        config: payload.config || null,
      }),
    );

    return partner;
  }

  async listPartners(organizationId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.partnerToolkit);

    const partners = await this.partnerRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });

    if (!partners.length) {
      return [];
    }

    const partnerIds = partners.map((partner) => partner.id);
    const partnerTenants = await this.partnerTenantRepository.find({
      where: {
        organization_id: organizationId,
        partner_id: In(partnerIds),
      },
      order: { created_at: 'DESC' },
    });

    const tenantCountByPartner = new Map<string, number>();
    for (const row of partnerTenants) {
      tenantCountByPartner.set(row.partner_id, (tenantCountByPartner.get(row.partner_id) || 0) + 1);
    }

    return partners.map((partner) => ({
      ...partner,
      onboarded_tenants: tenantCountByPartner.get(partner.id) || 0,
    }));
  }

  async onboardPartnerOrganization(
    organizationId: string,
    partnerId: string,
    payload: {
      tenant_organization_id: string;
      onboarding_status?: 'PENDING' | 'ACTIVE' | 'PAUSED';
      metadata?: Record<string, unknown>;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.partnerToolkit);

    const partner = await this.partnerRepository.findOne({
      where: { id: partnerId, organization_id: organizationId },
      select: ['id', 'organization_id'],
    });

    if (!partner) {
      throw new NotFoundException('Partner not found');
    }

    const targetOrganization = await this.organizationRepository.findOne({
      where: { id: payload.tenant_organization_id },
      select: ['id', 'name', 'subdomain', 'custom_domain'],
    });

    if (!targetOrganization) {
      throw new NotFoundException('Target organization not found');
    }

    const existing = await this.partnerTenantRepository.findOne({
      where: {
        partner_id: partnerId,
        tenant_organization_id: payload.tenant_organization_id,
      },
    });

    if (existing) {
      existing.onboarding_status = payload.onboarding_status || existing.onboarding_status;
      if (payload.metadata !== undefined) {
        existing.metadata = payload.metadata;
      }
      const savedExisting = await this.partnerTenantRepository.save(existing);
      return {
        ...savedExisting,
        tenant_organization: {
          id: targetOrganization.id,
          name: targetOrganization.name,
          subdomain: targetOrganization.subdomain,
          custom_domain: targetOrganization.custom_domain,
        },
      };
    }

    const created = await this.partnerTenantRepository.save(
      this.partnerTenantRepository.create({
        organization_id: organizationId,
        partner_id: partnerId,
        tenant_organization_id: payload.tenant_organization_id,
        onboarding_status: payload.onboarding_status || 'PENDING',
        metadata: payload.metadata || null,
      }),
    );

    return {
      ...created,
      tenant_organization: {
        id: targetOrganization.id,
        name: targetOrganization.name,
        subdomain: targetOrganization.subdomain,
        custom_domain: targetOrganization.custom_domain,
      },
    };
  }

  async createDunningCampaign(
    organizationId: string,
    payload: {
      name: string;
      description?: string;
      status?: string;
      min_days_overdue?: number;
      max_days_overdue?: number;
      min_outstanding_amount?: string;
      escalation_rules?: Record<string, any>;
      filter_criteria?: Record<string, any>;
      execution_frequency?: string;
    },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    const campaign = await this.dunningCampaignRepository.save(
      this.dunningCampaignRepository.create({
        organization_id: organizationId,
        name: payload.name,
        description: payload.description || null,
        status: payload.status || 'DRAFT',
        min_days_overdue: payload.min_days_overdue ?? 7,
        max_days_overdue: payload.max_days_overdue ?? 365,
        min_outstanding_amount: payload.min_outstanding_amount || '0',
        escalation_rules: payload.escalation_rules || {},
        filter_criteria: payload.filter_criteria || {},
        execution_frequency: payload.execution_frequency || 'MANUAL',
      }),
    );

    return campaign;
  }

  async listDunningCampaigns(organizationId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    return this.dunningCampaignRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });
  }

  async getDunningCampaign(organizationId: string, campaignId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    const campaign = await this.dunningCampaignRepository.findOne({
      where: { id: campaignId, organization_id: organizationId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    return campaign;
  }

  async updateDunningCampaign(
    organizationId: string,
    campaignId: string,
    payload: Record<string, any>,
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    const campaign = await this.getDunningCampaign(organizationId, campaignId);

    const updates: Record<string, any> = {};
    if (payload.name !== undefined) updates.name = payload.name;
    if (payload.description !== undefined) updates.description = payload.description;
    if (payload.status !== undefined) updates.status = payload.status;
    if (payload.min_days_overdue !== undefined) updates.min_days_overdue = payload.min_days_overdue;
    if (payload.max_days_overdue !== undefined) updates.max_days_overdue = payload.max_days_overdue;
    if (payload.min_outstanding_amount !== undefined) updates.min_outstanding_amount = payload.min_outstanding_amount;
    if (payload.escalation_rules !== undefined) updates.escalation_rules = payload.escalation_rules;
    if (payload.filter_criteria !== undefined) updates.filter_criteria = payload.filter_criteria;
    if (payload.execution_frequency !== undefined) updates.execution_frequency = payload.execution_frequency;

    await this.dunningCampaignRepository.update(campaignId, updates);

    return this.getDunningCampaign(organizationId, campaignId);
  }

  async runDunningCampaign(
    organizationId: string,
    campaignId: string,
    payload: { dry_run?: boolean; scheduled_for?: string },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    const campaign = await this.getDunningCampaign(organizationId, campaignId);

    const dunningRun = await this.dunningRunRepository.save(
      this.dunningRunRepository.create({
        campaign_id: campaignId,
        status: 'SCHEDULED',
        scheduled_for: payload.scheduled_for ? new Date(payload.scheduled_for) : new Date(),
      }),
    );

    // If not a dry run, compute arrears snapshots for eligible contacts
    if (!payload.dry_run) {
      await this.computeArrearsSnapshots(organizationId, campaignId, dunningRun.id);
    }

    // Queue integration deliveries if enabled
    await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'dunning_run_created', {
      campaign_id: campaignId,
      run_id: dunningRun.id,
      contacts_evaluated: dunningRun.contacts_evaluated,
    });

    // Increment campaign's total_runs counter
    await this.dunningCampaignRepository.increment(
      { id: campaignId },
      'total_runs',
      1,
    );

    return dunningRun;
  }

  private async computeArrearsSnapshots(
    organizationId: string,
    campaignId: string,
    runId: string,
  ) {
    const campaign = await this.dunningCampaignRepository.findOne({
      where: { id: campaignId },
    });

    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    // Fetch eligible contacts: payments overdue between min and max days
    // This is a simplified implementation - in production would be more sophisticated
    const now = new Date();
    const minDate = new Date(now.getTime() - campaign.max_days_overdue * 24 * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() - campaign.min_days_overdue * 24 * 60 * 60 * 1000);

    // Find contacts with outstanding payments in the date range
    const payments = await this.paymentRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.contact', 'c')
      .where('p.organization_id = :organizationId', { organizationId })
      .andWhere('p.status = :status', { status: 'UNRECEIVED' })
      .andWhere('p.expected_at BETWEEN :minDate AND :maxDate', { minDate, maxDate })
      .andWhere('CAST(p.amount AS NUMERIC) >= CAST(:minAmount AS NUMERIC)', {
        minAmount: campaign.min_outstanding_amount,
      })
      .select('p.id, p.contact_id, p.amount, p.expected_at, c.id')
      .getRawMany();

    // Group by contact and compute arrears
    const contactMap = new Map<string, { outstanding: string; daysOverdue: number; dueDate: Date }>();

    for (const payment of payments) {
      if (!contactMap.has(payment.p_contact_id)) {
        const daysOverdue = Math.floor((now.getTime() - new Date(payment.p_expected_at).getTime()) / (24 * 60 * 60 * 1000));
        contactMap.set(payment.p_contact_id, {
          outstanding: payment.p_amount,
          daysOverdue,
          dueDate: new Date(payment.p_expected_at),
        });
      } else {
        const existing = contactMap.get(payment.p_contact_id);
          if (existing) {
        existing.outstanding = String(Number(existing.outstanding) + Number(payment.p_amount));
          }
      }
    }

    // Create snapshots for each contact
    const snapshots = Array.from(contactMap.entries()).map(([contactId, data]) => {
      return this.arrearsSnapshotRepository.create({
        run_id: runId,
        contact_id: contactId,
        outstanding_amount: data.outstanding,
        days_overdue: data.daysOverdue,
        current_stage: 0,
        status: 'NOT_STARTED',
        delinquency_start_date: data.dueDate,
        metadata: {},
      });
    });

    if (snapshots.length > 0) {
      await this.arrearsSnapshotRepository.save(snapshots);

      // Update run metrics
      const totalOutstanding = snapshots.reduce((sum, s) => sum + Number(s.outstanding_amount), 0);

      await this.dunningRunRepository.update(runId, {
        contacts_evaluated: snapshots.length,
        total_outstanding: String(totalOutstanding),
        status: 'COMPLETED',
        completed_at: new Date(),
      });

      // Update campaign's snapshot
      await this.dunningCampaignRepository.update(campaignId, {
        total_outstanding_snapshot: String(totalOutstanding),
        last_executed_at: new Date(),
      });
    }
  }

  async listDunningRuns(organizationId: string, campaignId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    const campaign = await this.getDunningCampaign(organizationId, campaignId);

    return this.dunningRunRepository.find({
      where: { campaign_id: campaign.id },
      order: { created_at: 'DESC' },
    });
  }

  async listArrearsSnapshots(organizationId: string, runId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.arrearsDunning);

    // Verify run belongs to this org by joining through campaign
    const run = await this.dunningRunRepository
      .createQueryBuilder('dr')
      .leftJoinAndSelect('dr.campaign', 'dc')
      .where('dr.id = :runId', { runId })
      .andWhere('dc.organization_id = :organizationId', { organizationId })
      .getOne();

    if (!run) {
      throw new NotFoundException('Run not found');
    }

    return this.arrearsSnapshotRepository.find({
      where: { run_id: runId },
      relations: ['contact'],
      order: { captured_at: 'DESC' },
    });
  }

  async createComplianceExportPackJob(
    organizationId: string,
    requestedByUserId: string,
    payload: { scope?: Record<string, unknown>; request_reason?: string },
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.complianceExportPack);

    const job = await this.complianceExportJobRepository.save(
      this.complianceExportJobRepository.create({
        organization_id: organizationId,
        requested_by_user_id: requestedByUserId,
        status: 'QUEUED',
        scope: payload.scope || null,
        request_reason: payload.request_reason || null,
        completed_at: null,
        download_url: null,
      }),
    );

    await this.complianceExportArtifactRepository.save(
      this.complianceExportArtifactRepository.create({
        organization_id: organizationId,
        job_id: job.id,
        artifact_type: 'REQUEST_SCOPE',
        file_path: `job://${job.id}/scope.json`,
        checksum: null,
        size_bytes: null,
        metadata: payload.scope || {},
      }),
    );

    await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.compliance.export_pack.queued', {
      job_id: job.id,
      requested_by_user_id: requestedByUserId,
      scope: payload.scope || {},
      queued_at: job.created_at,
    });

    return {
      ...job,
      artifacts_count: 1,
    };
  }

  async listComplianceExportPackJobs(
    organizationId: string,
    page = 1,
    limit = 20,
    status?: string,
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.complianceExportPack);

    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const allowedStatuses = ['QUEUED', 'PROCESSING', 'READY', 'FAILED'] as const;
    const normalizedStatus = allowedStatuses.includes((status || '').toUpperCase() as any)
      ? ((status || '').toUpperCase() as typeof allowedStatuses[number])
      : undefined;

    const where = normalizedStatus
      ? { organization_id: organizationId, status: normalizedStatus }
      : { organization_id: organizationId };

    const [data, total] = await this.complianceExportJobRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
    });

    return {
      data,
      total,
      page: safePage,
      limit: safeLimit,
    };
  }

  async getComplianceExportPackJob(organizationId: string, jobId: string) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.complianceExportPack);

    const job = await this.complianceExportJobRepository.findOne({
      where: { id: jobId, organization_id: organizationId },
    });

    if (!job) {
      throw new NotFoundException('Compliance export job not found');
    }

    const artifacts = await this.complianceExportArtifactRepository.find({
      where: { organization_id: organizationId, job_id: jobId },
      order: { created_at: 'ASC' },
    });

    return {
      ...job,
      artifacts,
    };
  }

  async processComplianceExportPackJob(
    organizationId: string,
    requestedByUserId: string,
    jobId: string,
  ) {
    await this.assertFeatureEnabled(organizationId, MARKET_FLAG_KEYS.complianceExportPack);

    const job = await this.complianceExportJobRepository.findOne({
      where: { id: jobId, organization_id: organizationId },
    });

    if (!job) {
      throw new NotFoundException('Compliance export job not found');
    }

    if (job.status === 'READY') {
      return this.getComplianceExportPackJob(organizationId, jobId);
    }

    job.status = 'PROCESSING';
    await this.complianceExportJobRepository.save(job);

    try {
      const [contactsCount, submissionsCount, paymentsCount] = await Promise.all([
        this.contactRepository.count({ where: { organization_id: organizationId } }),
        this.submissionRepository.count({ where: { organization_id: organizationId } }),
        this.paymentRepository.count({ where: { organization_id: organizationId } }),
      ]);

      const generatedAt = new Date().toISOString();
      const exportSummary = {
        generated_at: generatedAt,
        generated_by_user_id: requestedByUserId,
        scope: job.scope || {},
        totals: {
          contacts: contactsCount,
          submissions: submissionsCount,
          payments: paymentsCount,
        },
      };

      const summaryPayload = JSON.stringify(exportSummary);
      const summaryChecksum = createHash('sha256').update(summaryPayload).digest('hex');

      const artifactsToCreate = [
        this.complianceExportArtifactRepository.create({
          organization_id: organizationId,
          job_id: job.id,
          artifact_type: 'EXPORT_SUMMARY_JSON',
          file_path: `exports/${organizationId}/${job.id}/summary.json`,
          checksum: summaryChecksum,
          size_bytes: String(Buffer.byteLength(summaryPayload, 'utf8')),
          metadata: exportSummary,
        }),
        this.complianceExportArtifactRepository.create({
          organization_id: organizationId,
          job_id: job.id,
          artifact_type: 'AUDIT_POINTER',
          file_path: `exports/${organizationId}/${job.id}/audit.csv`,
          checksum: null,
          size_bytes: null,
          metadata: {
            note: 'Artifact placeholder generated until async export workers are connected',
            requested_by_user_id: requestedByUserId,
          },
        }),
      ];

      await this.complianceExportArtifactRepository.save(artifactsToCreate);

      job.status = 'READY';
      job.completed_at = new Date();
      job.download_url = `/v1/market/compliance/export-pack/jobs/${job.id}`;
      await this.complianceExportJobRepository.save(job);

      await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.compliance.export_pack.ready', {
        job_id: job.id,
        requested_by_user_id: requestedByUserId,
        completed_at: job.completed_at,
      });
    } catch (error) {
      job.status = 'FAILED';
      job.completed_at = new Date();
      await this.complianceExportJobRepository.save(job);

      await this.queueIntegrationDeliveriesIfEnabled(organizationId, 'market.compliance.export_pack.failed', {
        job_id: job.id,
        requested_by_user_id: requestedByUserId,
        failed_at: job.completed_at,
      });

      throw error;
    }

    return this.getComplianceExportPackJob(organizationId, job.id);
  }

  private async queueIntegrationDeliveries(
    organizationId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const activeEndpoints = await this.integrationEndpointRepository.find({
      where: {
        organization_id: organizationId,
        active: true,
      },
    });

    if (!activeEndpoints.length) {
      return;
    }

    const payloadHash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');

    await this.integrationDeliveryRepository.save(
      activeEndpoints.map((endpoint) => this.integrationDeliveryRepository.create({
        organization_id: organizationId,
        endpoint_id: endpoint.id,
        event_type: eventType,
        payload_hash: payloadHash,
        status: 'QUEUED',
        attempts: 0,
      })),
    );
  }

  private async queueIntegrationDeliveriesIfEnabled(
    organizationId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ) {
    const flags = await this.getFlags(organizationId);
    if (!flags[MARKET_FLAG_KEYS.integrations]) {
      return;
    }

    await this.queueIntegrationDeliveries(organizationId, eventType, payload);
  }

  private sanitizeIntegrationEndpoint(endpoint: IntegrationEndpoint) {
    const maskedSecret = endpoint.secret.length <= 8
      ? '********'
      : `${endpoint.secret.slice(0, 4)}...${endpoint.secret.slice(-4)}`;

    return {
      ...endpoint,
      secret: undefined,
      secret_preview: maskedSecret,
    };
  }

  private normalizeFlags(flags: Record<string, boolean>) {
    const normalized: Record<string, boolean> = {
      [MARKET_FLAG_KEYS.checkoutV2]: false,
      [MARKET_FLAG_KEYS.abandonedRecovery]: false,
      [MARKET_FLAG_KEYS.installments]: false,
      [MARKET_FLAG_KEYS.arrearsDunning]: false,
      [MARKET_FLAG_KEYS.reconciliationWorkspace]: false,
      [MARKET_FLAG_KEYS.integrations]: false,
      [MARKET_FLAG_KEYS.partnerToolkit]: false,
      [MARKET_FLAG_KEYS.complianceExportPack]: false,
    };

    for (const [key, value] of Object.entries(flags || {})) {
      if (Object.prototype.hasOwnProperty.call(normalized, key)) {
        normalized[key] = Boolean(value);
      }
    }

    return normalized;
  }

  private async assertFeatureEnabled(organizationId: string, key: string) {
    const flags = await this.getFlags(organizationId);
    if (!flags[key]) {
      throw new ForbiddenException(`Feature "${key}" is disabled for this organization`);
    }
  }
}
