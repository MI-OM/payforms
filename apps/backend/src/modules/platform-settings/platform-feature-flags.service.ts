import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { PlatformFeatureFlag } from './entities/platform-feature-flag.entity';
import { PlatformFeatureFlagOverride } from './entities/platform-feature-flag-override.entity';
import {
  normalizePlatformKey,
  isValidPlatformKey,
} from './platform-settings.constants';
import {
  ListFeatureFlagsQueryDto,
  SetFeatureFlagOverrideDto,
  UpsertFeatureFlagDto,
} from './dto/platform-settings.dto';
import { PlatformActor } from './platform-settings.service';

export interface ResolvedFeatureFlag {
  key: string;
  enabled: boolean;
  source: 'global' | 'override' | 'missing';
  organization_id?: string | null;
}

/**
 * Feature flags with per-organization overrides (Part 3, Wave A, Module 5).
 *
 * A flag has a global default; an optional `(flag, organization)` override wins
 * for that tenant. `resolve`/`isEnabled` are the read API other modules can use
 * — the default for an unknown flag is **disabled**, so a typo never opens a
 * gate.
 */
@Injectable()
export class PlatformFeatureFlagsService {
  constructor(
    @InjectRepository(PlatformFeatureFlag)
    private readonly flagRepository: Repository<PlatformFeatureFlag>,
    @InjectRepository(PlatformFeatureFlagOverride)
    private readonly overrideRepository: Repository<PlatformFeatureFlagOverride>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
  ) {}

  async list(query: ListFeatureFlagsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const qb = this.flagRepository.createQueryBuilder('flag');

    if (query.enabled !== undefined) {
      qb.andWhere('flag.enabled = :enabled', { enabled: query.enabled });
    }
    if (query.search) {
      const keyword = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('flag.key ILIKE :keyword', { keyword }).orWhere(
            'flag.description ILIKE :keyword',
            { keyword },
          );
        }),
      );
    }

    qb.orderBy('flag.key', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toView(row)),
      total,
      page,
      limit,
    };
  }

  async detail(key: string) {
    const flag = await this.requireFlag(key);
    const overrides = await this.overrideRepository.find({
      where: { flag_key: flag.key },
      order: { updated_at: 'DESC' },
    });
    return {
      flag: this.toView(flag),
      overrides: overrides.map((override) => this.toOverrideView(override)),
    };
  }

  async upsert(key: string, dto: UpsertFeatureFlagDto, actor: PlatformActor) {
    const normalizedKey = this.assertKey(key);

    let flag = await this.flagRepository.findOne({ where: { key: normalizedKey } });
    if (!flag) {
      flag = this.flagRepository.create({ key: normalizedKey, enabled: false });
    }

    flag.enabled = dto.enabled;
    if (dto.description !== undefined) {
      flag.description = dto.description;
    }
    if (dto.metadata !== undefined) {
      flag.metadata = dto.metadata;
    }
    flag.updated_by_platform_user_id = actor?.id ?? null;
    flag.updated_by_email = actor?.email ?? null;

    const saved = await this.flagRepository.save(flag);
    return { flag: this.toView(saved) };
  }

  async remove(key: string) {
    const flag = await this.requireFlag(key);
    // Overrides are meaningless without their flag; remove them explicitly so a
    // re-created flag starts from a clean slate.
    await this.overrideRepository.delete({ flag_key: flag.key });
    await this.flagRepository.remove(flag);
    return { key: flag.key, deleted: true };
  }

  async setOverride(
    key: string,
    organizationId: string,
    dto: SetFeatureFlagOverrideDto,
    actor: PlatformActor,
  ) {
    const flag = await this.requireFlag(key);
    await this.requireOrganization(organizationId);

    let override = await this.overrideRepository.findOne({
      where: { flag_key: flag.key, organization_id: organizationId },
    });
    if (!override) {
      override = this.overrideRepository.create({
        flag_key: flag.key,
        organization_id: organizationId,
      });
    }

    override.enabled = dto.enabled;
    if (dto.reason !== undefined) {
      override.reason = dto.reason.trim() || null;
    }
    override.updated_by_platform_user_id = actor?.id ?? null;
    override.updated_by_email = actor?.email ?? null;

    const saved = await this.overrideRepository.save(override);
    return { override: this.toOverrideView(saved) };
  }

  async clearOverride(key: string, organizationId: string) {
    const flag = await this.requireFlag(key);
    const override = await this.overrideRepository.findOne({
      where: { flag_key: flag.key, organization_id: organizationId },
    });
    if (!override) {
      throw new NotFoundException('Override not found');
    }
    await this.overrideRepository.remove(override);
    return { flag_key: flag.key, organization_id: organizationId, deleted: true };
  }

  /**
   * Effective value of a flag for an optional organization. An override beats
   * the global default; an unknown flag resolves to disabled.
   */
  async resolve(key: string, organizationId?: string | null): Promise<ResolvedFeatureFlag> {
    const normalizedKey = normalizePlatformKey(key);
    const flag = await this.flagRepository.findOne({ where: { key: normalizedKey } });
    if (!flag) {
      return {
        key: normalizedKey,
        enabled: false,
        source: 'missing',
        organization_id: organizationId ?? null,
      };
    }

    if (organizationId) {
      const override = await this.overrideRepository.findOne({
        where: { flag_key: flag.key, organization_id: organizationId },
      });
      if (override) {
        return {
          key: flag.key,
          enabled: override.enabled,
          source: 'override',
          organization_id: organizationId,
        };
      }
    }

    return {
      key: flag.key,
      enabled: flag.enabled,
      source: 'global',
      organization_id: organizationId ?? null,
    };
  }

  async isEnabled(key: string, organizationId?: string | null): Promise<boolean> {
    return (await this.resolve(key, organizationId)).enabled;
  }

  private async requireFlag(key: string): Promise<PlatformFeatureFlag> {
    const normalizedKey = this.assertKey(key);
    const flag = await this.flagRepository.findOne({ where: { key: normalizedKey } });
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }
    return flag;
  }

  private async requireOrganization(organizationId: string): Promise<Organization> {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id'],
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    return organization;
  }

  private assertKey(key: string): string {
    const normalized = normalizePlatformKey(key);
    if (!isValidPlatformKey(normalized)) {
      throw new BadRequestException(
        'Invalid feature flag key. Use lowercase letters, digits, dot, dash or underscore (2-64 chars, starting with a letter).',
      );
    }
    return normalized;
  }

  private toView(flag: PlatformFeatureFlag) {
    return {
      id: flag.id,
      key: flag.key,
      description: flag.description ?? null,
      enabled: flag.enabled,
      metadata: flag.metadata ?? null,
      updated_by_platform_user_id: flag.updated_by_platform_user_id ?? null,
      updated_by_email: flag.updated_by_email ?? null,
      created_at: flag.created_at,
      updated_at: flag.updated_at,
    };
  }

  private toOverrideView(override: PlatformFeatureFlagOverride) {
    return {
      id: override.id,
      flag_key: override.flag_key,
      organization_id: override.organization_id,
      enabled: override.enabled,
      reason: override.reason ?? null,
      updated_by_platform_user_id: override.updated_by_platform_user_id ?? null,
      updated_by_email: override.updated_by_email ?? null,
      created_at: override.created_at,
      updated_at: override.updated_at,
    };
  }
}
