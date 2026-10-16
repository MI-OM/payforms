import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { User } from '../auth/entities/user.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { OrganizationEntitlementsService } from '../organization/organization-entitlements.service';
import { OrganizationUsageEvent } from './entities/organization-usage-event.entity';

/**
 * A resource that counts against a plan limit. These strings are exactly the
 * keys of `PlanLimits`, so a metric can be resolved without a lookup table.
 */
export type BillableResource =
  | 'forms'
  | 'contacts'
  | 'staff_users'
  | 'monthly_submissions'
  | 'monthly_email_sends'
  | 'storage_gb';

/** Human labels for error messages, keyed by resource. */
const RESOURCE_LABELS: Record<BillableResource, string> = {
  forms: 'Forms',
  contacts: 'Contacts',
  staff_users: 'Staff seats',
  monthly_submissions: 'Monthly submissions',
  monthly_email_sends: 'Monthly email sends',
  storage_gb: 'Storage',
};

/** Natural unit each metric is measured in, for messages. */
const RESOURCE_UNITS: Record<BillableResource, string> = {
  forms: 'forms',
  contacts: 'contacts',
  staff_users: 'seats',
  monthly_submissions: 'submissions',
  monthly_email_sends: 'sends',
  storage_gb: 'GB',
};

export const BYTES_PER_GB = 1024 * 1024 * 1024;

export interface BillingPlan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'business' | 'enterprise';
  monthly_cost_cents: number;
  soft_limits: PlanLimits;
  hard_limits: PlanLimits;
}

export interface PlanLimits {
  forms: number;
  contacts: number;
  staff_users: number;
  monthly_submissions: number;
  monthly_email_sends: number;
  storage_gb: number;
}

export interface PlanUsage {
  organization_id: string;
  forms_created: number;
  contacts_total: number;
  staff_users_total: number;
  submissions_this_month: number;
  email_sends_this_month: number;
  storage_used_gb: number;
  /** Raw storage total — `storage_used_gb` is this rounded to 2dp. */
  storage_used_bytes: number;
}

/**
 * Thrown when a write would breach a hard plan limit. Extends
 * `BadRequestException` so existing error handling keeps working, but adds
 * structured fields the caller can act on (which metric, how much room is
 * left).
 */
export class PlanLimitExceededException extends BadRequestException {
  constructor(
    readonly resource: BillableResource,
    readonly limit: number,
    readonly currentUsage: number,
    readonly requested: number,
    message: string,
  ) {
    super(message);
  }
}

@Injectable()
export class BillingService {
  private readonly BILLING_PLANS: Record<string, BillingPlan> = {
    free: {
      id: 'plan_free',
      name: 'Free',
      tier: 'free',
      monthly_cost_cents: 0,
      soft_limits: {
        forms: 5,
        contacts: 500,
        staff_users: 1,
        monthly_submissions: 1000,
        monthly_email_sends: 100,
        storage_gb: 1,
      },
      hard_limits: {
        forms: 10,
        contacts: 1000,
        staff_users: 2,
        monthly_submissions: 2000,
        monthly_email_sends: 200,
        storage_gb: 2,
      },
    },
    starter: {
      id: 'plan_starter',
      name: 'Starter',
      tier: 'starter',
      monthly_cost_cents: 2999,
      soft_limits: {
        forms: 50,
        contacts: 5000,
        staff_users: 5,
        monthly_submissions: 10000,
        monthly_email_sends: 5000,
        storage_gb: 10,
      },
      hard_limits: {
        forms: 100,
        contacts: 10000,
        staff_users: 10,
        monthly_submissions: 20000,
        monthly_email_sends: 10000,
        storage_gb: 20,
      },
    },
    professional: {
      id: 'plan_professional',
      name: 'Professional',
      tier: 'professional',
      monthly_cost_cents: 9999,
      soft_limits: {
        forms: 500,
        contacts: 50000,
        staff_users: 25,
        monthly_submissions: 100000,
        monthly_email_sends: 50000,
        storage_gb: 100,
      },
      hard_limits: {
        forms: 1000,
        contacts: 100000,
        staff_users: 50,
        monthly_submissions: 200000,
        monthly_email_sends: 100000,
        storage_gb: 200,
      },
    },
    business: {
      id: 'plan_business',
      name: 'Business',
      tier: 'business',
      // Interim catalog row until the versioned plan catalog (Part 1) lands.
      monthly_cost_cents: 19999,
      soft_limits: {
        forms: 500,
        contacts: 10000,
        staff_users: 25,
        monthly_submissions: 500000,
        monthly_email_sends: 300000,
        storage_gb: 250,
      },
      hard_limits: {
        forms: 2000,
        contacts: 20000,
        staff_users: 50,
        monthly_submissions: 1000000,
        monthly_email_sends: 500000,
        storage_gb: 500,
      },
    },
    enterprise: {
      id: 'plan_enterprise',
      name: 'Enterprise',
      tier: 'enterprise',
      monthly_cost_cents: 0, // custom pricing
      soft_limits: {
        forms: 10000,
        contacts: 1000000,
        staff_users: 500,
        monthly_submissions: 10000000,
        monthly_email_sends: 1000000,
        storage_gb: 1000,
      },
      hard_limits: {
        forms: 100000,
        contacts: 10000000,
        staff_users: 5000,
        monthly_submissions: 100000000,
        monthly_email_sends: 10000000,
        storage_gb: 10000,
      },
    },
  };

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(ActivityLog)
    private auditLogRepository: Repository<ActivityLog>,
    @InjectRepository(OrganizationUsageEvent)
    private usageEventRepository: Repository<OrganizationUsageEvent>,
    private readonly organizationEntitlementsService: OrganizationEntitlementsService,
  ) {}

  /** Current plan definition for a tier code (null when unknown). */
  getPlanLimits(tier: string | null | undefined): BillingPlan | null {
    return this.BILLING_PLANS[tier || 'free'] ?? null;
  }

  /**
   * Full in-code catalog (Part 1 will replace this with a versioned table).
   * Platform consoles should read this instead of hardcoding tier names.
   */
  listCatalog(): BillingPlan[] {
    return Object.values(this.BILLING_PLANS);
  }

  /**
   * Get plan details for an organization
   */
  async getOrganizationPlan(organizationId: string): Promise<BillingPlan> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const plan = this.BILLING_PLANS[org.billing_plan_tier || 'free'];
    if (!plan) {
      throw new BadRequestException(`Invalid billing plan: ${org.billing_plan_tier}`);
    }

    // Manual per-org entitlement overrides (Module 8): negotiated limits
    // replace the plan defaults; the response shape is unchanged.
    const override = await this.organizationEntitlementsService.getForOrganization(organizationId);
    return this.organizationEntitlementsService.mergePlanWithOverrides(plan, override);
  }

  /**
   * Start of the current calendar month (UTC), the window every `monthly_*`
   * metric is measured over.
   */
  private getMonthStart(now: Date = new Date()): Date {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
  }

  /**
   * Calculate current usage for an organization.
   *
   * Every metric is a real query — forms, contacts, staff seats and
   * submissions are counted from their tenant tables; email sends and storage
   * bytes are summed from the `organization_usage_events` ledger.
   */
  async calculateUsage(organizationId: string): Promise<PlanUsage> {
    const monthStart = this.getMonthStart();

    const [formsCount, contactsCount, staffUsersTotal, submissionsThisMonth, emailSendsThisMonth, storageUsedBytes] =
      await Promise.all([
        this.formRepository.count({ where: { organization_id: organizationId } }),
        this.contactRepository.count({ where: { organization_id: organizationId } }),
        this.userRepository.count({ where: { organization_id: organizationId } }),
        this.submissionRepository
          .createQueryBuilder('submission')
          .where('submission.organization_id = :organizationId', { organizationId })
          .andWhere('submission.created_at >= :monthStart', { monthStart })
          .getCount(),
        this.sumUsageEvents(organizationId, 'EMAIL_SEND', monthStart),
        this.sumUsageEvents(organizationId, 'STORAGE_BYTES'),
      ]);

    return {
      organization_id: organizationId,
      forms_created: formsCount,
      contacts_total: contactsCount,
      staff_users_total: staffUsersTotal,
      submissions_this_month: submissionsThisMonth,
      email_sends_this_month: emailSendsThisMonth,
      storage_used_bytes: storageUsedBytes,
      storage_used_gb: Number((storageUsedBytes / BYTES_PER_GB).toFixed(2)),
    };
  }

  /**
   * Sum a usage-event metric for an organization, optionally from a date
   * onwards. `amount` is a bigint column, so Postgres returns SUM as a string.
   *
   * Reads FAIL OPEN: if the ledger is unreadable the metric is treated as empty
   * instead of throwing. Metering must never take down the feature it measures,
   * and this code ships ahead of its migration (`synchronize` is off in
   * production), so a missing table would otherwise break every tenant email
   * send. The error is logged loudly so a pending migration is obvious.
   */
  private async sumUsageEvents(
    organizationId: string,
    metric: OrganizationUsageEvent['metric'],
    since?: Date,
  ): Promise<number> {
    const qb = this.usageEventRepository
      .createQueryBuilder('usage_event')
      .select('COALESCE(SUM(usage_event.amount), 0)', 'total')
      .where('usage_event.organization_id = :organizationId', { organizationId })
      .andWhere('usage_event.metric = :metric', { metric });

    if (since) {
      qb.andWhere('usage_event.created_at >= :since', { since });
    }

    try {
      const raw = await qb.getRawOne<{ total: string | number }>();
      const total = Number(raw?.total ?? 0);
      return Number.isFinite(total) ? total : 0;
    } catch (error) {
      console.error(
        'Unable to read the organization usage ledger — is the AddOrganizationUsageEvents migration applied?',
        { organizationId, metric, message: (error as Error)?.message },
      );
      return 0;
    }
  }

  /**
   * Record consumption of a metered resource. Used only for the metrics that
   * have no tenant table to count (email sends, storage bytes).
   */
  async recordUsage(
    organizationId: string,
    metric: OrganizationUsageEvent['metric'],
    amount: number,
    note?: string | null,
  ): Promise<void> {
    if (!Number.isFinite(amount) || amount <= 0) {
      return;
    }

    try {
      await this.usageEventRepository.save(
        this.usageEventRepository.create({
          organization_id: organizationId,
          metric,
          amount: String(Math.round(amount)),
          note: note ? note.slice(0, 200) : null,
        }),
      );
    } catch (error) {
      // Metering must never take down the feature it measures. The plan limit
      // will simply read low until the next event records successfully.
      console.error('Failed to record organization usage event', {
        organizationId,
        metric,
        message: (error as Error)?.message,
      });
    }
  }

  /**
   * Resolve a single metric's current usage, in the metric's natural unit
   * (counts for everything except `storage_gb`, which is bytes).
   */
  async getUsageForResource(organizationId: string, resource: BillableResource): Promise<number> {
    const monthStart = this.getMonthStart();

    switch (resource) {
      case 'forms':
        return this.formRepository.count({ where: { organization_id: organizationId } });
      case 'contacts':
        return this.contactRepository.count({ where: { organization_id: organizationId } });
      case 'staff_users':
        return this.userRepository.count({ where: { organization_id: organizationId } });
      case 'monthly_submissions':
        return this.submissionRepository
          .createQueryBuilder('submission')
          .where('submission.organization_id = :organizationId', { organizationId })
          .andWhere('submission.created_at >= :monthStart', { monthStart })
          .getCount();
      case 'monthly_email_sends':
        return this.sumUsageEvents(organizationId, 'EMAIL_SEND', monthStart);
      case 'storage_gb':
        return this.sumUsageEvents(organizationId, 'STORAGE_BYTES');
      default:
        return 0;
    }
  }

  /**
   * Guard a write against the organization's *effective* hard limit, i.e. its
   * plan defaults merged with any negotiated per-org entitlement override.
   *
   * Call this immediately before persisting, passing how much the operation
   * consumes: `1` for "create one row", the batch size for imports, the
   * recipient count for email, and the byte size for storage.
   *
   * For every metric except `storage_gb`, `increment` is a count. For
   * `storage_gb`, `increment` is BYTES (the stored limit is converted to bytes
   * before comparison) so sub-gigabyte uploads are measured exactly rather than
   * rounded into a false pass.
   *
   * Throws `PlanLimitExceededException` and writes an audit record when the
   * write would exceed the limit.
   */
  async assertWithinHardLimit(
    organizationId: string,
    resource: BillableResource,
    increment = 1,
  ): Promise<void> {
    const plan = await this.getOrganizationPlan(organizationId);
    const limit = plan.hard_limits[resource];
    const currentUsage = await this.getUsageForResource(organizationId, resource);

    if (limit === undefined || limit === null) {
      return;
    }

    // Usage and increments for `storage_gb` are measured in BYTES while the
    // limit is a gigabyte figure, so the limit is converted into the same unit
    // before comparing. Every other metric is a plain count on both sides.
    const limitInMetricUnits = resource === 'storage_gb' ? limit * BYTES_PER_GB : limit;
    const projected = currentUsage + increment;

    if (projected > limitInMetricUnits) {
      const unit = RESOURCE_UNITS[resource];
      const label = RESOURCE_LABELS[resource];
      const message =
        resource === 'storage_gb'
          ? `${label} limit reached: your ${plan.name} plan allows ${limit}GB and this upload would exceed it. Upgrade your plan to add more.`
          : `${label} limit reached: your ${plan.name} plan allows ${limit} ${unit} and this action would make ${projected}. Upgrade your plan to add more.`;

      await this.recordLimitBlocked(organizationId, resource, limit, currentUsage, increment);

      throw new PlanLimitExceededException(resource, limit, currentUsage, increment, message);
    }
  }

  /** Persist an audit record whenever a write is rejected by a plan limit. */
  private async recordLimitBlocked(
    organizationId: string,
    resource: BillableResource,
    limit: number,
    currentUsage: number,
    increment: number,
  ): Promise<void> {
    try {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          organization_id: organizationId,
          action: 'BILLING_LIMIT_EXCEEDED',
          entity_type: 'billing',
          entity_id: organizationId,
          metadata: {
            resource,
            limit,
            current_usage: currentUsage,
            requested: increment,
          },
        }),
      );
    } catch (error) {
      // The block itself is the important part; never let audit failure turn a
      // 400 into a 500.
      console.error('Failed to record billing limit audit event', {
        organizationId,
        resource,
        message: (error as Error)?.message,
      });
    }
  }

  /**
   * Check if organization is within soft or hard limits
   */
  async checkLimits(organizationId: string, plan?: BillingPlan): Promise<{
    withinLimits: boolean;
    violations: string[];
    warnings: string[];
  }> {
    const resolvedPlan: BillingPlan = plan ?? (await this.getOrganizationPlan(organizationId));
    const usage = await this.calculateUsage(organizationId);

    const violations: string[] = [];
    const warnings: string[] = [];


    // Check hard limits (reject requests)
    if (usage.forms_created > resolvedPlan.hard_limits.forms) {
      violations.push(`Forms limit (${resolvedPlan.hard_limits.forms}) exceeded`);
    }
    if (usage.contacts_total > resolvedPlan.hard_limits.contacts) {
      violations.push(`Contacts limit (${resolvedPlan.hard_limits.contacts}) exceeded`);
    }
    if (usage.staff_users_total > resolvedPlan.hard_limits.staff_users) {
      violations.push(`Staff users limit (${resolvedPlan.hard_limits.staff_users}) exceeded`);
    }
    if (usage.submissions_this_month > resolvedPlan.hard_limits.monthly_submissions) {
      violations.push(`Monthly submissions limit (${resolvedPlan.hard_limits.monthly_submissions}) exceeded`);
    }
    if (usage.email_sends_this_month > resolvedPlan.hard_limits.monthly_email_sends) {
      violations.push(`Monthly email sends limit (${resolvedPlan.hard_limits.monthly_email_sends}) exceeded`);
    }
    // Compare bytes, not the rounded gigabyte figure, so a few hundred MB over
    // the line is still a violation instead of rounding down to a pass.
    if (usage.storage_used_bytes > resolvedPlan.hard_limits.storage_gb * BYTES_PER_GB) {
      violations.push(`Storage limit (${resolvedPlan.hard_limits.storage_gb}GB) exceeded`);
    }

    const softWarningThreshold = (limit: number) => Math.floor(limit * 0.8);

    // Check soft limits (warnings)
    if (usage.forms_created >= softWarningThreshold(resolvedPlan.soft_limits.forms)) {
      warnings.push(`Approaching forms limit (${resolvedPlan.soft_limits.forms})`);
    }
    if (usage.contacts_total >= softWarningThreshold(resolvedPlan.soft_limits.contacts)) {
      warnings.push(`Approaching contacts limit (${resolvedPlan.soft_limits.contacts})`);
    }
    if (usage.staff_users_total > 0 && usage.staff_users_total >= softWarningThreshold(resolvedPlan.soft_limits.staff_users)) {
      warnings.push(`Approaching staff users limit (${resolvedPlan.soft_limits.staff_users})`);
    }
    if (usage.submissions_this_month >= softWarningThreshold(resolvedPlan.soft_limits.monthly_submissions)) {
      warnings.push(`Approaching monthly submissions limit (${resolvedPlan.soft_limits.monthly_submissions})`);
    }
    if (usage.email_sends_this_month >= softWarningThreshold(resolvedPlan.soft_limits.monthly_email_sends)) {
      warnings.push(
        `Approaching monthly email sends limit (${resolvedPlan.soft_limits.monthly_email_sends})`,
      );
    }
    if (usage.storage_used_bytes > 0 && usage.storage_used_bytes >= softWarningThreshold(resolvedPlan.soft_limits.storage_gb) * BYTES_PER_GB) {
      warnings.push(`Approaching storage limit (${resolvedPlan.soft_limits.storage_gb}GB)`);
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Enforce hard limits against CURRENT usage (increment 0) — throws if the
   * organization is already over. Use `assertWithinHardLimit` to guard a new
   * write; this blanket form is for callers that want a single "is this org
   * allowed to operate at all" gate.
   */
  async enforceHardLimits(organizationId: string): Promise<void> {
    const limits = await this.checkLimits(organizationId);

    if (!limits.withinLimits) {
      try {
        await this.auditLogRepository.save(
          this.auditLogRepository.create({
            organization_id: organizationId,
            action: 'BILLING_LIMIT_EXCEEDED',
            entity_type: 'billing',
            entity_id: organizationId,
            metadata: { violations: limits.violations },
          }),
        );
      } catch (error) {
        console.error('Failed to record billing limit audit event', {
          organizationId,
          message: (error as Error)?.message,
        });
      }

      throw new BadRequestException(
        `Billing limits exceeded: ${limits.violations.join('; ')}. Please upgrade your plan.`,
      );
    }
  }

  /**
   * Upgrade organization plan
   */
  async upgradePlan(organizationId: string, newPlanTier: string): Promise<Organization> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    // Validate plan exists
    if (!this.BILLING_PLANS[newPlanTier]) {
      throw new BadRequestException(`Invalid plan tier: ${newPlanTier}`);
    }

    org.billing_plan_tier = newPlanTier;
    const updated = await this.organizationRepository.save(org);

    // Log plan change
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        action: 'PLAN_UPGRADED',
        entity_type: 'billing',
        entity_id: organizationId,
        metadata: {
          old_plan: org.billing_plan_tier,
          new_plan: newPlanTier,
        },
      }),
    );

    return updated;
  }

  /**
   * Get usage report for organization
   */
  async getUsageReport(organizationId: string): Promise<{
    organization_id: string;
    plan: BillingPlan;
    usage: PlanUsage;
    limits: { withinLimits: boolean; violations: string[]; warnings: string[] };
    recommendations: string[];
  }> {
    const plan = await this.getOrganizationPlan(organizationId);
    const usage = await this.calculateUsage(organizationId);
    const limits = await this.checkLimits(organizationId, plan);

    // Generate recommendations
    const recommendations: string[] = [];
    if (limits.violations.length > 0) {
      recommendations.push('Please upgrade your plan to continue');
    } else if (limits.warnings.length > 2) {
      recommendations.push(
        `Consider upgrading from ${plan.name} to access higher limits`,
      );
    }

    if (usage.contacts_total > 1000 && plan.tier === 'free') {
      recommendations.push('Large contact base detected. Starter plan recommended.');
    }

    return {
      organization_id: organizationId,
      plan,
      usage,
      limits,
      recommendations,
    };
  }
}
