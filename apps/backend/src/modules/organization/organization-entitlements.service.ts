import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntitlementOverride } from './entities/organization-entitlement-override.entity';

/** Shape of a BillingService plan (soft/hard limit buckets). */
export interface PlanLimits {
  soft_limits: object;
  hard_limits: object;
}

export interface EntitlementOverrideInput {
  contacts_limit?: number | null;
  forms_limit?: number | null;
  staff_users_limit?: number | null;
  monthly_submissions_limit?: number | null;
  monthly_email_sends_limit?: number | null;
  storage_gb_limit?: number | null;
  notes?: string | null;
}

/** Override column ↔ billing limit key. */
export const OVERRIDE_COLUMNS: Record<keyof Omit<EntitlementOverrideInput, 'notes'>, string> = {
  contacts_limit: 'contacts',
  forms_limit: 'forms',
  staff_users_limit: 'staff_users',
  monthly_submissions_limit: 'monthly_submissions',
  monthly_email_sends_limit: 'monthly_email_sends',
  storage_gb_limit: 'storage_gb',
};

/**
 * Dependency-light service (mirrors the OrganizationStatusService pattern) so
 * the tenant billing read path and the platform console can both resolve an
 * organization's effective limits without pulling in heavy modules.
 */
@Injectable()
export class OrganizationEntitlementsService {
  constructor(
    @InjectRepository(OrganizationEntitlementOverride)
    private readonly overrideRepository: Repository<OrganizationEntitlementOverride>,
  ) {}

  async getForOrganization(organizationId: string): Promise<OrganizationEntitlementOverride | null> {
    return this.overrideRepository.findOne({ where: { organization_id: organizationId } });
  }

  /**
   * Merge plan defaults with an override row. A set override column replaces
   * BOTH the soft and hard limit for that metric; NULL columns inherit.
   * Returns a new object — the input plan is never mutated.
   */
  mergePlanWithOverrides<T extends PlanLimits>(plan: T, override: OrganizationEntitlementOverride | null): T {
    if (!override) {
      return plan;
    }

    const merged: T = {
      ...plan,
      soft_limits: { ...(plan.soft_limits as Record<string, number>) },
      hard_limits: { ...(plan.hard_limits as Record<string, number>) },
    };

    for (const [column, metric] of Object.entries(OVERRIDE_COLUMNS)) {
      const value = (override as unknown as Record<string, number | null>)[column];
      if (typeof value === 'number') {
        (merged.soft_limits as Record<string, number>)[metric] = value;
        (merged.hard_limits as Record<string, number>)[metric] = value;
      }
    }

    return merged;
  }

  /**
   * Create or update the override row. Only keys present in `input` change:
   * a number sets the limit, an explicit null clears it (back to plan default).
   */
  async upsert(
    organizationId: string,
    input: EntitlementOverrideInput,
    actor: { id?: string | null; email?: string | null } | null,
  ): Promise<OrganizationEntitlementOverride> {
    const existing = (await this.getForOrganization(organizationId)) ?? this.overrideRepository.create({ organization_id: organizationId });

    for (const column of Object.keys(OVERRIDE_COLUMNS) as (keyof typeof OVERRIDE_COLUMNS)[]) {
      if (column in input) {
        (existing as unknown as Record<string, unknown>)[column] = input[column] ?? null;
      }
    }
    if ('notes' in input) {
      existing.notes = input.notes ?? null;
    }

    existing.set_by_platform_user_id = actor?.id ?? null;
    existing.set_by_email = actor?.email ?? null;

    return this.overrideRepository.save(existing);
  }

  /** Remove all overrides for an organization. Returns true if a row was removed. */
  async clear(organizationId: string): Promise<boolean> {
    const existing = await this.getForOrganization(organizationId);
    if (!existing) return false;
    await this.overrideRepository.remove(existing);
    return true;
  }
}
