import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { User } from '../auth/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationStatusService } from '../organization/services/organization-status.service';
import { OrganizationContextService } from '../../common/auth/organization-context.service';
import {
  ChangeUserStatusDto,
  ListPlatformUsersQueryDto,
  ResetUserTwoFactorDto,
} from './dto/platform-users.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

/**
 * Backs the platform admin directory (Part 3, Wave B, Module 7).
 *
 * Operators can look a user up across every tenant, disable/enable the account
 * and reset its two-factor state. The `users` table is under Row Level Security,
 * so every query here runs inside `runWithoutContext(...)`, which makes the
 * cross-tenant read an *explicit*, auditable choice instead of relying on the
 * implicit system-context fallback.
 *
 * The projections are curated: `password_hash`, `refresh_token_hash`,
 * `password_reset_token` and every `two_factor_*` secret never leave this
 * boundary. Only the boolean `two_factor_enabled` flag is reported.
 */
@Injectable()
export class PlatformUsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly organizationStatusService: OrganizationStatusService,
    private readonly organizationContextService: OrganizationContextService,
  ) {}

  async list(query: ListPlatformUsersQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    return this.organizationContextService.runWithoutContext(async () => {
      const qb = this.userRepository
        .createQueryBuilder('user')
        .leftJoin('user.organization', 'organization')
        .addSelect([
          'organization.id',
          'organization.name',
          'organization.email',
          'organization.subdomain',
          'organization.status',
          'organization.suspended_until',
          'organization.status_reason',
        ]);

      if (query.organization_id) {
        qb.andWhere('user.organization_id = :organizationId', {
          organizationId: query.organization_id,
        });
      }
      if (query.role) {
        qb.andWhere('user.role = :role', { role: query.role });
      }
      if (query.status) {
        qb.andWhere('user.is_active = :isActive', {
          isActive: query.status === 'active',
        });
      }
      if (query.email) {
        qb.andWhere('user.email ILIKE :email', { email: `%${query.email}%` });
      }
      if (query.search) {
        const keyword = `%${query.search}%`;
        qb.andWhere(
          new Brackets((w) => {
            w.where('user.email ILIKE :keyword', { keyword })
              .orWhere('user.first_name ILIKE :keyword', { keyword })
              .orWhere('user.last_name ILIKE :keyword', { keyword })
              .orWhere('CAST(user.id AS text) ILIKE :keyword', { keyword });
          }),
        );
      }

      qb.orderBy('user.created_at', 'DESC')
        .skip((page - 1) * limit)
        .take(limit);

      const [rows, total] = await qb.getManyAndCount();

      return {
        data: rows.map((user) => this.toSummary(user)),
        total,
        page,
        limit,
      };
    });
  }

  async detail(userId: string) {
    return this.organizationContextService.runWithoutContext(async () => {
      // `two_factor_enabled` is `select: false`, so ask for it explicitly to
      // report the account's 2FA state without ever selecting its secret.
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.two_factor_enabled')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      return {
        user: this.toDetail(user),
        organization: await this.loadOrganizationSummary(user.organization_id),
      };
    });
  }

  async changeStatus(
    userId: string,
    dto: ChangeUserStatusDto,
    actor: PlatformActor,
  ) {
    const reason = dto.reason?.trim() || null;
    const disabling = dto.is_active === false;

    if (disabling && !reason) {
      throw new BadRequestException('A reason is required to disable a user');
    }

    return this.organizationContextService.runWithoutContext(async () => {
      const user = await this.userRepository.findOne({
        where: { id: userId },
        relations: ['organization'],
      });
      if (!user) {
        throw new NotFoundException('User not found');
      }

      const previous = user.is_active;
      const changed = previous !== dto.is_active;

      if (changed) {
        // Disabling revokes existing sessions immediately: clearing the refresh
        // token hash stops the refresh flow, and the tenant auth guard rejects
        // inactive users on every access token validation.
        await this.userRepository.update(user.id, {
          is_active: dto.is_active,
          deactivated_at: dto.is_active ? null : new Date(),
          refresh_token_hash: null,
        });
      }

      return {
        user_id: user.id,
        email: user.email,
        previous_is_active: previous,
        is_active: dto.is_active,
        changed,
        reason: dto.is_active ? null : reason,
        changed_by: actor?.id ?? null,
        organization: user.organization
          ? {
              id: user.organization.id,
              name: user.organization.name,
            }
          : null,
      };
    });
  }

  async resetTwoFactor(
    userId: string,
    dto: ResetUserTwoFactorDto,
    actor: PlatformActor,
  ) {
    const reason = dto.reason?.trim() || null;

    return this.organizationContextService.runWithoutContext(async () => {
      const user = await this.userRepository
        .createQueryBuilder('user')
        .addSelect('user.two_factor_enabled')
        .where('user.id = :userId', { userId })
        .getOne();

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const wasEnabled = Boolean(user.two_factor_enabled);

      if (wasEnabled || user.two_factor_secret) {
        // Clear the whole 2FA state: disabling it and discarding the secret,
        // any pending enrolment and the recovery codes. The user can re-enrol
        // from scratch on their next sign-in.
        await this.userRepository.update(user.id, {
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_temp_secret: null,
          two_factor_temp_expires_at: null,
          two_factor_recovery_codes: null,
        });
      }

      return {
        user_id: user.id,
        email: user.email,
        two_factor_enabled: false,
        changed: wasEnabled,
        reason,
        changed_by: actor?.id ?? null,
      };
    });
  }

  private async loadOrganizationSummary(organizationId: string) {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: [
        'id',
        'name',
        'email',
        'subdomain',
        'status',
        'status_reason',
        'suspended_until',
      ],
    });
    return org ? this.toOrganizationSummary(org) : null;
  }

  private toSummary(user: User) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      deactivated_at: user.deactivated_at,
      organization_id: user.organization_id,
      created_at: user.created_at,
      organization: user.organization
        ? {
            id: user.organization.id,
            name: user.organization.name,
            subdomain: user.organization.subdomain ?? null,
            status: this.organizationStatusService.resolveEffectiveStatus(
              user.organization,
            ),
            is_blocked: this.organizationStatusService.isBlocked(user.organization),
          }
        : null,
    };
  }

  private toDetail(user: User) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      title: user.title,
      designation: user.designation,
      role: user.role,
      is_active: user.is_active,
      deactivated_at: user.deactivated_at,
      two_factor_enabled: Boolean(user.two_factor_enabled),
      organization_id: user.organization_id,
      created_at: user.created_at,
    };
  }

  private toOrganizationSummary(org: Organization) {
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      subdomain: org.subdomain ?? null,
      status: this.organizationStatusService.resolveEffectiveStatus(org),
      stored_status: (org.status as string) || 'active',
      status_reason: org.status_reason ?? null,
      suspended_until: org.suspended_until ?? null,
      is_blocked: this.organizationStatusService.isBlocked(org),
    };
  }
}
