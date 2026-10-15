import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import {
  normalizePlatformKey,
  isValidPlatformKey,
  PlatformSettingValueType,
} from './platform-settings.constants';
import {
  ListPlatformSettingsQueryDto,
  SetPlatformSettingDto,
} from './dto/platform-settings.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

/**
 * Typed global platform settings (Part 3, Wave A, Module 5).
 *
 * Provider/integration configuration is just settings in a dedicated category,
 * so the plan's `provider_settings` concept is covered without a separate table.
 *
 * `is_secret` values are stored verbatim but NEVER returned by the API — reads
 * expose only `has_value`, matching how Paystack secrets are handled elsewhere.
 * `getRawValue` is the escape hatch for trusted internal callers.
 */
@Injectable()
export class PlatformSettingsService {
  constructor(
    @InjectRepository(PlatformSetting)
    private readonly settingRepository: Repository<PlatformSetting>,
  ) {}

  async list(query: ListPlatformSettingsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const qb = this.settingRepository.createQueryBuilder('setting');

    if (query.category) {
      qb.andWhere('setting.category = :category', { category: query.category });
    }
    if (query.search) {
      const keyword = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('setting.key ILIKE :keyword', { keyword }).orWhere(
            'setting.description ILIKE :keyword',
            { keyword },
          );
        }),
      );
    }

    qb.orderBy('setting.key', 'ASC')
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

  async get(key: string) {
    const setting = await this.settingRepository.findOne({
      where: { key: this.assertKey(key) },
    });
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    return this.toView(setting);
  }

  async set(key: string, dto: SetPlatformSettingDto, actor: PlatformActor) {
    const normalizedKey = this.assertKey(key);
    this.assertValueMatchesType(dto.value, dto.value_type);

    let setting = await this.settingRepository.findOne({
      where: { key: normalizedKey },
    });
    if (!setting) {
      setting = this.settingRepository.create({ key: normalizedKey });
    }

    setting.value = dto.value;
    setting.value_type = dto.value_type;
    if (dto.category !== undefined) {
      setting.category = dto.category;
    } else if (!setting.category) {
      setting.category = 'GENERAL';
    }
    if (dto.description !== undefined) {
      setting.description = dto.description;
    }
    if (dto.is_secret !== undefined) {
      setting.is_secret = dto.is_secret;
    }
    setting.updated_by_platform_user_id = actor?.id ?? null;
    setting.updated_by_email = actor?.email ?? null;

    const saved = await this.settingRepository.save(setting);
    return this.toView(saved);
  }

  async remove(key: string) {
    const normalizedKey = this.assertKey(key);
    const setting = await this.settingRepository.findOne({
      where: { key: normalizedKey },
    });
    if (!setting) {
      throw new NotFoundException('Setting not found');
    }
    await this.settingRepository.remove(setting);
    return { key: normalizedKey, deleted: true };
  }

  /**
   * Internal, unmasked read. Intentionally not exposed over HTTP.
   */
  async getRawValue<T = any>(key: string): Promise<T | null> {
    const setting = await this.settingRepository.findOne({
      where: { key: normalizePlatformKey(key) },
    });
    return (setting?.value ?? null) as T | null;
  }

  private assertKey(key: string): string {
    const normalized = normalizePlatformKey(key);
    if (!isValidPlatformKey(normalized)) {
      throw new BadRequestException(
        'Invalid setting key. Use lowercase letters, digits, dot, dash or underscore (2-64 chars, starting with a letter).',
      );
    }
    return normalized;
  }

  private assertValueMatchesType(value: any, type: PlatformSettingValueType): void {
    const ok =
      type === 'string'
        ? typeof value === 'string'
        : type === 'number'
          ? typeof value === 'number' && Number.isFinite(value)
          : type === 'boolean'
            ? typeof value === 'boolean'
            : value !== null && typeof value === 'object';
    if (!ok) {
      throw new BadRequestException(`value must be a valid ${type}`);
    }
  }

  private toView(setting: PlatformSetting) {
    return {
      id: setting.id,
      key: setting.key,
      // Secrets never leave the platform boundary.
      value: setting.is_secret ? null : setting.value ?? null,
      has_value: setting.value !== null && setting.value !== undefined,
      value_type: setting.value_type,
      category: setting.category,
      description: setting.description ?? null,
      is_secret: setting.is_secret,
      updated_by_platform_user_id: setting.updated_by_platform_user_id ?? null,
      updated_by_email: setting.updated_by_email ?? null,
      created_at: setting.created_at,
      updated_at: setting.updated_at,
    };
  }
}
