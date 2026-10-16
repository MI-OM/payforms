import { ForbiddenException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { OrganizationStatus } from '../organization-status.constants';

export interface OrganizationStatusSnapshot {
  organization_id: string;
  /** Status after applying `suspended_until` expiry (may differ from `stored_status`). */
  status: OrganizationStatus;
  /** Raw value persisted on the row. */
  stored_status: OrganizationStatus;
  reason: string | null;
  suspended_until: Date | null;
  changed_at: Date | null;
  changed_by: string | null;
  is_blocked: boolean;
}

type StatusBearing = Pick<
  Organization,
  'id' | 'status' | 'status_reason' | 'status_changed_at' | 'status_changed_by' | 'suspended_until'
>;

/**
 * Single source of truth for the organization "hard stop" (Part 3, Module 3).
 *
 * Deliberately lightweight (only depends on the `organizations` repository) so
 * it can be imported by the tenant auth flow and the public form flow without
 * pulling in heavier modules or creating cycles.
 *
 * `organizations` is not under RLS, so these reads behave identically in tenant
 * and system contexts.
 */
@Injectable()
export class OrganizationStatusService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  /**
   * A `suspended` org whose `suspended_until` has passed is treated as active
   * again without needing a background job.
   */
  resolveEffectiveStatus(
    org: Pick<Organization, 'status' | 'suspended_until'>,
    now: Date = new Date(),
  ): OrganizationStatus {
    const stored = (org.status as OrganizationStatus) || 'active';
    if (
      stored === 'suspended' &&
      org.suspended_until &&
      new Date(org.suspended_until).getTime() <= now.getTime()
    ) {
      return 'active';
    }
    return stored;
  }

  isBlocked(
    org: Pick<Organization, 'status' | 'suspended_until'>,
    now: Date = new Date(),
  ): boolean {
    const effective = this.resolveEffectiveStatus(org, now);
    return effective === 'suspended' || effective === 'disabled';
  }

  private toSnapshot(org: StatusBearing, now: Date = new Date()): OrganizationStatusSnapshot {
    return {
      organization_id: org.id,
      status: this.resolveEffectiveStatus(org, now),
      stored_status: (org.status as OrganizationStatus) || 'active',
      reason: org.status_reason ?? null,
      suspended_until: org.suspended_until ?? null,
      changed_at: org.status_changed_at ?? null,
      changed_by: org.status_changed_by ?? null,
      is_blocked: this.isBlocked(org, now),
    };
  }

  async getSnapshot(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<OrganizationStatusSnapshot | null> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: [
        'id',
        'status',
        'status_reason',
        'status_changed_at',
        'status_changed_by',
        'suspended_until',
      ],
    });
    return org ? this.toSnapshot(org, now) : null;
  }

  /**
   * Returns `true` only when the organization exists AND is blocked. A missing
   * organization is treated as "not blocked" so callers that already handle
   * unknown orgs (e.g. login → 401) keep their existing behaviour.
   */
  async isBlockedById(organizationId: string, now: Date = new Date()): Promise<boolean> {
    if (!organizationId) {
      return false;
    }
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'status', 'suspended_until'],
    });
    return org ? this.isBlocked(org, now) : false;
  }

  /** Throws `ForbiddenException` when the organization is under a hard stop. */
  async assertActive(
    organizationId: string,
    message = 'This organization is currently unavailable',
    now: Date = new Date(),
  ): Promise<void> {
    if (await this.isBlockedById(organizationId, now)) {
      throw new ForbiddenException(message);
    }
  }
}
