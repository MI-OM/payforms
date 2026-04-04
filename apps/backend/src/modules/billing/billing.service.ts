import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan, MoreThan } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

export interface BillingPlan {
  id: string;
  name: string;
  tier: 'free' | 'starter' | 'professional' | 'enterprise';
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
    @InjectRepository(ActivityLog)
    private auditLogRepository: Repository<ActivityLog>,
  ) {}

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

    return plan;
  }

  /**
   * Calculate current usage for an organization
   */
  async calculateUsage(organizationId: string): Promise<PlanUsage> {
    const firstDayOfMonth = new Date();
    firstDayOfMonth.setDate(1);
    firstDayOfMonth.setHours(0, 0, 0, 0);

    const formsCount = await this.formRepository.count({
      where: { organization_id: organizationId },
    });

    const contactsCount = await this.contactRepository.count({
      where: { organization_id: organizationId },
    });

    // Note: These would need actual data from database
    // For now, returning zeros for these metrics
    const submissionsThisMonth = 0;
    const emailSendsThisMonth = 0;
    const storageUsedGb = 0;
    const staffUsersTotal = 0; // Would come from users table

    return {
      organization_id: organizationId,
      forms_created: formsCount,
      contacts_total: contactsCount,
      staff_users_total: staffUsersTotal,
      submissions_this_month: submissionsThisMonth,
      email_sends_this_month: emailSendsThisMonth,
      storage_used_gb: storageUsedGb,
    };
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
    if (usage.storage_used_gb > resolvedPlan.hard_limits.storage_gb) {
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
    if (usage.storage_used_gb > 0 && usage.storage_used_gb >= softWarningThreshold(resolvedPlan.soft_limits.storage_gb)) {
      warnings.push(`Approaching storage limit (${resolvedPlan.soft_limits.storage_gb}GB)`);
    }

    return {
      withinLimits: violations.length === 0,
      violations,
      warnings,
    };
  }

  /**
   * Enforce hard limits - throws error if limits exceeded
   */
  async enforceHardLimits(organizationId: string): Promise<void> {
    const limits = await this.checkLimits(organizationId);

    if (!limits.withinLimits) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          organization_id: organizationId,
          action: 'BILLING_LIMIT_EXCEEDED',
          entity_type: 'billing',
          entity_id: organizationId,
          metadata: { violations: limits.violations },
        }),
      );

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
