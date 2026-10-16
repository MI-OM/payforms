import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import {
  OrganizationEntitlementsService,
  EntitlementOverrideInput,
} from '../organization/organization-entitlements.service';
import { BillingService } from '../billing/billing.service';
import { SetOrganizationEntitlementsDto } from './dto/platform-entitlements.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
}

/**
 * Platform entitlement console (Part 3, Module 8).
 *
 * Lets a SUPER operator view an organization's EFFECTIVE limits (plan defaults
 * merged with any manual overrides) and set/clear the negotiated overrides —
 * plus optionally change the billing tier — all in one audited action. This is
 * the interim tool while the full billing stack (Part 1 plan catalog +
 * subscriptions) is being decided.
 */
@Injectable()
export class PlatformEntitlementsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly organizationEntitlementsService: OrganizationEntitlementsService,
    private readonly billingService: BillingService,
  ) {}

  listPlans() {
    return this.billingService.listCatalog();
  }

  async view(organizationId: string) {
    const org = await this.requireOrganization(organizationId);
    const override = await this.organizationEntitlementsService.getForOrganization(organizationId);
    const plan = this.requirePlan(org.billing_plan_tier);
    const effective = this.organizationEntitlementsService.mergePlanWithOverrides(plan, override);

    return {
      organization_id: organizationId,
      plan: plan.tier,
      plan_name: plan.name,
      overrides: this.serializeOverrides(override),
      effective: {
        soft_limits: effective.soft_limits,
        hard_limits: effective.hard_limits,
      },
      set_by_email: override?.set_by_email ?? null,
      updated_at: override?.updated_at ?? null,
    };
  }

  async set(organizationId: string, dto: SetOrganizationEntitlementsDto, actor: PlatformActor) {
    const org = await this.requireOrganization(organizationId);

    let planChanged = false;
    if (dto.plan && dto.plan !== org.billing_plan_tier) {
      this.requirePlan(dto.plan);
      await this.organizationRepository.update(org.id, { billing_plan_tier: dto.plan });
      org.billing_plan_tier = dto.plan;
      planChanged = true;
    }

    const input: EntitlementOverrideInput = {};
    for (const key of [
      'contacts_limit',
      'forms_limit',
      'staff_users_limit',
      'monthly_submissions_limit',
      'monthly_email_sends_limit',
      'storage_gb_limit',
    ] as const) {
      if (key in dto) {
        input[key] = dto[key];
      }
    }
    if ('notes' in dto) {
      input.notes = dto.notes ?? null;
    }

    const hasOverrideChange = Object.keys(input).length > 0;
    let override = await this.organizationEntitlementsService.getForOrganization(organizationId);
    if (hasOverrideChange) {
      override = await this.organizationEntitlementsService.upsert(organizationId, input, actor);
    }

    if (!planChanged && !hasOverrideChange) {
      throw new BadRequestException('Nothing to change: provide a plan and/or at least one limit.');
    }

    const plan = this.requirePlan(org.billing_plan_tier);
    const effective = this.organizationEntitlementsService.mergePlanWithOverrides(plan, override);

    return {
      organization_id: organizationId,
      plan: plan.tier,
      plan_changed: planChanged,
      overrides: this.serializeOverrides(override),
      effective: {
        soft_limits: effective.soft_limits,
        hard_limits: effective.hard_limits,
      },
      set_by_email: override?.set_by_email ?? null,
      updated_at: override?.updated_at ?? null,
    };
  }

  async clear(organizationId: string) {
    await this.requireOrganization(organizationId);
    const removed = await this.organizationEntitlementsService.clear(organizationId);
    if (!removed) {
      throw new NotFoundException('No entitlement overrides set for this organization');
    }
    const org = await this.requireOrganization(organizationId);
    const plan = this.requirePlan(org.billing_plan_tier);
    return {
      organization_id: organizationId,
      cleared: true,
      plan: plan.tier,
      effective: {
        soft_limits: plan.soft_limits,
        hard_limits: plan.hard_limits,
      },
    };
  }

  private async requireOrganization(organizationId: string): Promise<Organization> {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return org;
  }

  private requirePlan(tier: string | null | undefined) {
    const plan = this.billingService.getPlanLimits(tier);
    if (!plan) {
      throw new BadRequestException(`Organization has an unknown billing tier: ${tier}`);
    }
    return plan;
  }

  private serializeOverrides(override: Awaited<ReturnType<OrganizationEntitlementsService['getForOrganization']>>) {
    if (!override) return null;
    return {
      contacts_limit: override.contacts_limit,
      forms_limit: override.forms_limit,
      staff_users_limit: override.staff_users_limit,
      monthly_submissions_limit: override.monthly_submissions_limit,
      monthly_email_sends_limit: override.monthly_email_sends_limit,
      storage_gb_limit: override.storage_gb_limit,
      notes: override.notes,
    };
  }
}
