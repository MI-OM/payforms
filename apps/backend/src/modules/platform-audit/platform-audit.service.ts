import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, Repository } from 'typeorm';
import { PlatformAuditLog } from './entities/platform-audit-log.entity';

export interface PlatformAuditRecordInput {
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: string;
  resourceType?: string | null;
  resourceId?: string | null;
  method: string;
  path: string;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, any> | null;
}

export interface PlatformAuditListQuery {
  page?: number;
  limit?: number;
  actor_id?: string;
  actor_email?: string;
  action?: string;
  resource_type?: string;
  resource_id?: string;
  method?: string;
  status_code?: number;
  ip_address?: string;
  keyword?: string;
  from?: string;
  to?: string;
}

/**
 * Persists and queries the platform admin audit trail.
 *
 * Writes are best-effort: an auditing failure must never break a platform
 * request, so `record()` swallows (and logs) errors rather than throwing.
 */
@Injectable()
export class PlatformAuditService {
  private readonly logger = new Logger(PlatformAuditService.name);

  constructor(
    @InjectRepository(PlatformAuditLog)
    private readonly auditRepository: Repository<PlatformAuditLog>,
  ) {}

  async record(input: PlatformAuditRecordInput): Promise<void> {
    try {
      await this.auditRepository.insert({
        actor_id: input.actorId ?? null,
        actor_email: input.actorEmail ?? null,
        actor_role: input.actorRole ?? null,
        action: input.action,
        resource_type: input.resourceType ?? null,
        resource_id: input.resourceId ?? null,
        method: input.method,
        path: input.path,
        status_code: input.statusCode ?? null,
        ip_address: input.ipAddress ?? null,
        user_agent: input.userAgent ?? null,
        metadata: input.metadata ?? {},
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write platform audit log for action "${input.action}": ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  async list(query: PlatformAuditListQuery = {}) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit =
      query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 20;

    const qb = this.auditRepository.createQueryBuilder('log');

    if (query.actor_id) {
      qb.andWhere('log.actor_id = :actor_id', { actor_id: query.actor_id });
    }
    if (query.actor_email) {
      qb.andWhere('log.actor_email ILIKE :actor_email', {
        actor_email: `%${query.actor_email}%`,
      });
    }
    if (query.action) {
      qb.andWhere('log.action = :action', { action: query.action });
    }
    if (query.resource_type) {
      qb.andWhere('log.resource_type = :resource_type', {
        resource_type: query.resource_type,
      });
    }
    if (query.resource_id) {
      qb.andWhere('log.resource_id = :resource_id', {
        resource_id: query.resource_id,
      });
    }
    if (query.method) {
      qb.andWhere('log.method = :method', {
        method: query.method.toUpperCase(),
      });
    }
    if (query.status_code !== undefined && query.status_code !== null) {
      qb.andWhere('log.status_code = :status_code', {
        status_code: query.status_code,
      });
    }
    if (query.ip_address) {
      qb.andWhere('log.ip_address ILIKE :ip_address', {
        ip_address: `%${query.ip_address}%`,
      });
    }
    if (query.keyword) {
      qb.andWhere(
        new Brackets((w) => {
          w.where('log.action ILIKE :keyword', { keyword: `%${query.keyword}%` })
            .orWhere('log.actor_email ILIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('log.path ILIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('log.resource_id ILIKE :keyword', {
              keyword: `%${query.keyword}%`,
            })
            .orWhere('log.metadata::text ILIKE :keyword', {
              keyword: `%${query.keyword}%`,
            });
        }),
      );
    }
    if (query.from) {
      qb.andWhere('log.created_at >= :from', { from: query.from });
    }
    if (query.to) {
      qb.andWhere('log.created_at <= :to', { to: query.to });
    }

    qb.orderBy('log.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await qb.getManyAndCount();
    return { data, total, page, limit };
  }

  async getById(id: string): Promise<PlatformAuditLog | null> {
    return this.auditRepository.findOne({ where: { id } });
  }
}
