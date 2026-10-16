import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository, SelectQueryBuilder } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationStatusEvent } from '../organization/entities/organization-status-event.entity';
import { OrganizationStatusService } from '../organization/services/organization-status.service';
import { OrganizationContextService } from '../../common/auth/organization-context.service';
import { OrganizationStatus } from '../organization/organization-status.constants';
import { User } from '../auth/entities/user.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Form } from '../form/entities/form.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Payment } from '../payment/entities/payment.entity';
import { BillingService } from '../billing/billing.service';
import {
  ChangeOrganizationStatusDto,
  ListOrganizationStatusEventsQueryDto,
  ListPlatformOrganizationsQueryDto,
} from './dto/platform-organizations.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

export interface OrganizationCounts {
  users: number;
  contacts: number;
  forms: number;
  submissions: number;
  payments: number;
}

/**
 * Backs the platform admin organization console (Part 3, Wave A, Module 3).
 *
 * Reads the tenant registry and drives the lifecycle status (the hard stop).
 * Cross-tenant counts are executed inside `runWithContext(orgId, ...)` so Row
 * Level Security scopes them to a single organization instead of bypassing.
 *
 * The detail view returns a curated projection: the raw `Organization` entity
 * carries `paystack_secret_key`, which must never leave the platform boundary.
 */
@Injectable()
export class PlatformOrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(OrganizationStatusEvent)
    private readonly statusEventRepository: Repository<OrganizationStatusEvent>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Contact)
    private readonly contactRepository: Repository<Contact>,
    @InjectRepository(Form)
    private readonly formRepository: Repository<Form>,
    @InjectRepository(Submission)
    private readonly submissionRepository: Repository<Submission>,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly organizationStatusService: OrganizationStatusService,
    private readonly organizationContextService: OrganizationContextService,
    private readonly billingService: BillingService,
  ) {}

  async list(query: ListPlatformOrganizationsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const qb = this.organizationRepository.createQueryBuilder('org');

    if (query.status) {
      this.applyStatusFilter(qb, query.status);
    }
    if (query.plan) {
      qb.andWhere('org.billing_plan_tier = :plan', { plan: query.plan.toLowerCase() });
    }
    if (query.search) {
      const keyword = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('org.name ILIKE :keyword', { keyword })
            .orWhere('org.email ILIKE :keyword', { keyword })
            .orWhere('org.subdomain ILIKE :keyword', { keyword })
            .orWhere('org.custom_domain ILIKE :keyword', { keyword })
            .orWhere('org.id::text ILIKE :keyword', { keyword });
        }),
      );
    }

    qb.orderBy('org.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((org) => this.toSummary(org)),
      total,
      page,
      limit,
    };
  }

  /**
   * Platform dashboard KPIs. Effective status matches `applyStatusFilter`
   * (expired suspensions count as active). Full analytics stays deferred.
   */
  async stats() {
    const now = new Date();
    const raw = await this.organizationRepository
      .createQueryBuilder('org')
      .select('COUNT(*)::int', 'total')
      .addSelect(`COUNT(*) FILTER (WHERE org.status = 'disabled')::int`, 'disabled')
      .addSelect(
        `COUNT(*) FILTER (WHERE org.status = 'suspended' AND (org.suspended_until IS NULL OR org.suspended_until > :now))::int`,
        'suspended',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE org.status = 'active' OR (org.status = 'suspended' AND org.suspended_until IS NOT NULL AND org.suspended_until <= :now))::int`,
        'active',
      )
      .setParameter('now', now)
      .getRawOne<{ total: string | number; active: string | number; suspended: string | number; disabled: string | number }>();

    return {
      total: Number(raw?.total ?? 0),
      active: Number(raw?.active ?? 0),
      suspended: Number(raw?.suspended ?? 0),
      disabled: Number(raw?.disabled ?? 0),
    };
  }

  async detail(organizationId: string) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const [counts, statusEvents] = await Promise.all([
      this.loadCounts(organizationId),
      this.statusEventRepository.find({
        where: { organization_id: organizationId },
        order: { created_at: 'DESC' },
        take: 20,
      }),
    ]);

    return {
      organization: this.toDetail(org),
      status: this.buildStatusView(org),
      counts,
      status_events: statusEvents,
    };
  }

  async changeStatus(
    organizationId: string,
    dto: ChangeOrganizationStatusDto,
    actor: PlatformActor,
  ) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const reason = dto.reason?.trim() || null;

    if ((dto.status === 'suspended' || dto.status === 'disabled') && !reason) {
      throw new BadRequestException(
        'A reason is required to suspend or disable an organization',
      );
    }
    if (dto.expires_at && dto.status !== 'suspended') {
      throw new BadRequestException(
        'expires_at can only be set when suspending an organization',
      );
    }

    let suspendedUntil: Date | null = null;
    if (dto.status === 'suspended' && dto.expires_at) {
      suspendedUntil = new Date(dto.expires_at);
      if (Number.isNaN(suspendedUntil.getTime())) {
        throw new BadRequestException('expires_at must be a valid ISO-8601 date');
      }
      if (suspendedUntil.getTime() <= Date.now()) {
        throw new BadRequestException('expires_at must be in the future');
      }
    }

    const previousStored = (org.status as OrganizationStatus) || 'active';
    const previousEffective = this.organizationStatusService.resolveEffectiveStatus(org);
    const previousUntil = org.suspended_until ?? null;

    const changed =
      previousStored !== dto.status ||
      !this.sameInstant(previousUntil, suspendedUntil);

    org.status = dto.status;
    org.status_reason = dto.status === 'active' ? null : reason;
    org.suspended_until = dto.status === 'suspended' ? suspendedUntil : null;
    org.status_changed_at = new Date();
    org.status_changed_by = actor?.id ?? null;

    await this.organizationRepository.save(org);

    if (changed) {
      await this.statusEventRepository.insert({
        organization_id: organizationId,
        previous_status: previousStored,
        new_status: dto.status,
        reason,
        expires_at: suspendedUntil,
        actor_platform_user_id: actor?.id ?? null,
        actor_email: actor?.email ?? null,
        metadata: {
          previous_effective_status: previousEffective,
          previous_suspended_until: previousUntil,
          actor_role: actor?.role ?? null,
        } as Record<string, any>,
      });
    }

    return {
      organization_id: organizationId,
      previous_status: previousStored,
      changed,
      status: this.buildStatusView(org),
    };
  }

  async usage(organizationId: string) {
    const exists = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException('Organization not found');
    }

    const usage = await this.organizationContextService.runWithContext(
      organizationId,
      '',
      () => this.billingService.calculateUsage(organizationId),
    );

    return { usage };
  }

  async listStatusEvents(
    organizationId: string,
    query: ListOrganizationStatusEventsQueryDto,
  ) {
    const exists = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id'],
    });
    if (!exists) {
      throw new NotFoundException('Organization not found');
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const [data, total] = await this.statusEventRepository.findAndCount({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return { data, total, page, limit };
  }

  private applyStatusFilter(
    qb: SelectQueryBuilder<Organization>,
    status: OrganizationStatus,
  ): void {
    const now = new Date();
    if (status === 'disabled') {
      qb.andWhere('org.status = :filterDisabled', { filterDisabled: 'disabled' });
      return;
    }
    if (status === 'suspended') {
      qb.andWhere(
        `org.status = 'suspended' AND (org.suspended_until IS NULL OR org.suspended_until > :filterNow)`,
        { filterNow: now },
      );
      return;
    }
    // active: stored as active, or suspended but already expired
    qb.andWhere(
      `(org.status = 'active' OR (org.status = 'suspended' AND org.suspended_until IS NOT NULL AND org.suspended_until <= :filterNow))`,
      { filterNow: now },
    );
  }

  private async loadCounts(organizationId: string): Promise<OrganizationCounts> {
    return this.organizationContextService.runWithContext(
      organizationId,
      '',
      async () => {
        const [users, contacts, forms, submissions, payments] = await Promise.all([
          this.userRepository.count({ where: { organization_id: organizationId } }),
          this.contactRepository.count({ where: { organization_id: organizationId } }),
          this.formRepository.count({ where: { organization_id: organizationId } }),
          this.submissionRepository.count({ where: { organization_id: organizationId } }),
          this.paymentRepository.count({ where: { organization_id: organizationId } }),
        ]);
        return { users, contacts, forms, submissions, payments };
      },
    );
  }

  private buildStatusView(org: Organization) {
    const snapshot = {
      organization_id: org.id,
      status: this.organizationStatusService.resolveEffectiveStatus(org),
      stored_status: (org.status as OrganizationStatus) || 'active',
      reason: org.status_reason ?? null,
      suspended_until: org.suspended_until ?? null,
      changed_at: org.status_changed_at ?? null,
      changed_by: org.status_changed_by ?? null,
      is_blocked: this.organizationStatusService.isBlocked(org),
    };
    return snapshot;
  }

  private toSummary(org: Organization) {
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      subdomain: org.subdomain,
      custom_domain: org.custom_domain,
      plan: org.billing_plan_tier,
      email_verified: org.email_verified,
      status: this.organizationStatusService.resolveEffectiveStatus(org),
      stored_status: (org.status as OrganizationStatus) || 'active',
      suspended_until: org.suspended_until ?? null,
      is_blocked: this.organizationStatusService.isBlocked(org),
      created_at: org.created_at,
    };
  }

  /**
   * Curated projection. Never exposes `paystack_secret_key`; callers only learn
   * whether keys are configured.
   */
  private toDetail(org: Organization) {
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      email_verified: org.email_verified,
      subdomain: org.subdomain,
      custom_domain: org.custom_domain,
      logo_url: org.logo_url,
      plan: org.billing_plan_tier,
      created_at: org.created_at,
      status: this.organizationStatusService.resolveEffectiveStatus(org),
      stored_status: (org.status as OrganizationStatus) || 'active',
      status_reason: org.status_reason ?? null,
      suspended_until: org.suspended_until ?? null,
      status_changed_at: org.status_changed_at ?? null,
      status_changed_by: org.status_changed_by ?? null,
      settings: {
        require_contact_login: org.require_contact_login,
        notify_submission_confirmation: org.notify_submission_confirmation,
        notify_payment_confirmation: org.notify_payment_confirmation,
        notify_payment_failure: org.notify_payment_failure,
        enabled_payment_methods: org.enabled_payment_methods,
        partial_payment_limit: org.partial_payment_limit,
        data_retention_contact_days: org.data_retention_contact_days,
        data_retention_submission_days: org.data_retention_submission_days,
        data_retention_audit_days: org.data_retention_audit_days,
        auto_purge_retention_enabled: org.auto_purge_retention_enabled,
      },
      paystack: {
        has_public_key: Boolean(org.paystack_public_key),
        has_secret_key: Boolean(org.paystack_secret_key),
      },
    };
  }

  private sameInstant(a: Date | null, b: Date | null): boolean {
    if (!a && !b) {
      return true;
    }
    if (!a || !b) {
      return false;
    }
    return new Date(a).getTime() === new Date(b).getTime();
  }
}
