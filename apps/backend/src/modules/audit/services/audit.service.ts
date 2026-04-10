import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ActivityLog } from '../entities/activity-log.entity';
import { PaymentLog } from '../entities/payment-log.entity';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private activityLogContactColumnPromise: Promise<boolean> | null = null;

  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(PaymentLog)
    private paymentLogRepository: Repository<PaymentLog>,
  ) {}

  async createActivityLog(
    organizationId: string,
    userId: string | null,
    contactId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, any> = {},
    ipAddress?: string | null,
    userAgent?: string | null,
  ) {
    const hasContactIdColumn = await this.hasActivityLogContactIdColumn();
    const payload: Record<string, any> = {
      organization_id: organizationId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    };

    if (hasContactIdColumn) {
      payload.contact_id = contactId;
    }

    const log = this.activityLogRepository.create(payload as any);

    try {
      return await this.activityLogRepository.save(log);
    } catch (error) {
      this.logger.warn(
        `Failed to persist activity log for action "${action}" in organization ${organizationId}: ${error instanceof Error ? error.message : String(error)}`,
      );
      return null;
    }
  }

  async listActivityLogs(
    organizationId: string,
    page = 1,
    limit = 20,
    filters: {
      action?: string;
      entity_type?: string;
      entity_id?: string;
      user_id?: string;
      contact_id?: string;
      ip_address?: string;
      user_agent?: string;
      keyword?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const hasContactIdColumn = await this.hasActivityLogContactIdColumn();
    const query = this.activityLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

    if (hasContactIdColumn) {
      query.addSelect('log.contact_id');
      query.leftJoinAndSelect('log.contact', 'contact');
    }

    query.where('log.organization_id = :organizationId', { organizationId });

    if (filters.action) {
      query.andWhere('log.action = :action', { action: filters.action });
    }
    if (filters.entity_type) {
      query.andWhere('log.entity_type = :entity_type', { entity_type: filters.entity_type });
    }
    if (filters.entity_id) {
      query.andWhere('log.entity_id = :entity_id', { entity_id: filters.entity_id });
    }
    if (filters.user_id) {
      query.andWhere('log.user_id = :user_id', { user_id: filters.user_id });
    }
    if (filters.contact_id) {
      if (hasContactIdColumn) {
        query.andWhere('log.contact_id = :contact_id', { contact_id: filters.contact_id });
      } else {
        query.andWhere(
          `COALESCE(log.metadata->'actor'->>'role', '') = 'CONTACT' AND COALESCE(log.metadata->'actor'->>'id', '') = :contact_id`,
          { contact_id: filters.contact_id },
        );
      }
    }
    if (filters.ip_address) {
      query.andWhere('log.ip_address ILIKE :ip_address', { ip_address: `%${filters.ip_address}%` });
    }
    if (filters.user_agent) {
      query.andWhere('log.user_agent ILIKE :user_agent', { user_agent: `%${filters.user_agent}%` });
    }
    if (filters.keyword) {
      query.andWhere(
        new Brackets(qb => {
          qb.where('log.action ILIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('log.entity_type ILIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('log.entity_id ILIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('log.metadata::text ILIKE :keyword', { keyword: `%${filters.keyword}%` });
        }),
      );
    }
    if (filters.from) {
      query.andWhere('log.created_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('log.created_at <= :to', { to: filters.to });
    }

    query.orderBy('log.created_at', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  formatActor(log: ActivityLog) {
    const relatedUser = log.user;
    const relatedContact = log.contact;
    const actorMetadata = log.metadata?.actor;
    const firstName = relatedUser?.first_name ?? relatedContact?.first_name ?? actorMetadata?.first_name ?? null;
    const middleName = relatedUser?.middle_name ?? relatedContact?.middle_name ?? actorMetadata?.middle_name ?? null;
    const lastName = relatedUser?.last_name ?? relatedContact?.last_name ?? actorMetadata?.last_name ?? null;
    const role = relatedUser?.role ?? actorMetadata?.role ?? (relatedContact ? 'CONTACT' : null);
    const email = relatedUser?.email ?? relatedContact?.email ?? actorMetadata?.email ?? null;
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

    if (!relatedUser && !relatedContact && !actorMetadata && !log.user_id && !log.contact_id) {
      return {
        id: null,
        name: 'System',
        role: 'SYSTEM',
        email: null,
        label: 'System',
      };
    }

    const resolvedName = name || email || log.user_id || log.contact_id || 'Unknown User';
    const roleSuffix = role ? ` (${role})` : '';

    return {
      id: relatedUser?.id ?? relatedContact?.id ?? actorMetadata?.id ?? log.user_id ?? log.contact_id,
      name: resolvedName,
      role,
      email,
      label: `${resolvedName}${roleSuffix}`,
    };
  }

  async listPaymentLogs(
    organizationId: string,
    paymentId: string,
    page = 1,
    limit = 20,
    filters: {
      event?: string;
      event_id?: string;
      from?: string;
      to?: string;
      keyword?: string;
    } = {},
  ) {
    const query = this.paymentLogRepository.createQueryBuilder('log');

    query.where('log.organization_id = :organizationId', { organizationId });
    query.andWhere('log.payment_id = :paymentId', { paymentId });

    if (filters.event) {
      query.andWhere('log.event = :event', { event: filters.event });
    }
    if (filters.event_id) {
      query.andWhere('log.event_id = :event_id', { event_id: filters.event_id });
    }
    if (filters.from) {
      query.andWhere('log.created_at >= :from', { from: filters.from });
    }
    if (filters.to) {
      query.andWhere('log.created_at <= :to', { to: filters.to });
    }
    if (filters.keyword) {
      query.andWhere(
        new Brackets(qb => {
          qb.where('log.event ILIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('log.event_id ILIKE :keyword', { keyword: `%${filters.keyword}%` })
            .orWhere('log.payload::text ILIKE :keyword', { keyword: `%${filters.keyword}%` });
        }),
      );
    }

    query.orderBy('log.created_at', 'DESC');
    query.skip((page - 1) * limit).take(limit);

    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  private async hasActivityLogContactIdColumn() {
    if (!this.activityLogContactColumnPromise) {
      this.activityLogContactColumnPromise = this.activityLogRepository
        .query(`
          SELECT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'activity_logs'
              AND column_name = 'contact_id'
          ) AS exists
        `)
        .then((rows: Array<{ exists: boolean }>) => Boolean(rows?.[0]?.exists))
        .catch(error => {
          this.activityLogContactColumnPromise = null;
          throw error;
        });
    }

    return this.activityLogContactColumnPromise;
  }
}
