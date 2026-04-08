import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Brackets } from 'typeorm';
import { ActivityLog } from '../entities/activity-log.entity';
import { PaymentLog } from '../entities/payment-log.entity';
import { User } from '../../auth/entities/user.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ActivityLog)
    private activityLogRepository: Repository<ActivityLog>,
    @InjectRepository(PaymentLog)
    private paymentLogRepository: Repository<PaymentLog>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) {}

  async createActivityLog(
    organizationId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string,
    metadata: Record<string, any> = {},
    ipAddress?: string | null,
    userAgent?: string | null,
  ) {
    const log = this.activityLogRepository.create({
      organization_id: organizationId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata,
      ip_address: ipAddress,
      user_agent: userAgent,
    } as any);
    return this.activityLogRepository.save(log);
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
      ip_address?: string;
      user_agent?: string;
      keyword?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const query = this.activityLogRepository.createQueryBuilder('log')
      .leftJoinAndSelect('log.user', 'user');

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
    const actorMetadata = log.metadata?.actor;
    const firstName = relatedUser?.first_name ?? actorMetadata?.first_name ?? null;
    const middleName = relatedUser?.middle_name ?? actorMetadata?.middle_name ?? null;
    const lastName = relatedUser?.last_name ?? actorMetadata?.last_name ?? null;
    const role = relatedUser?.role ?? actorMetadata?.role ?? null;
    const email = relatedUser?.email ?? actorMetadata?.email ?? null;
    const name = [firstName, middleName, lastName].filter(Boolean).join(' ').trim();

    if (!relatedUser && !actorMetadata && !log.user_id) {
      return {
        id: null,
        name: 'System',
        role: 'SYSTEM',
        email: null,
        label: 'System',
      };
    }

    const resolvedName = name || email || log.user_id || 'Unknown User';
    const roleSuffix = role ? ` (${role})` : '';

    return {
      id: relatedUser?.id ?? actorMetadata?.id ?? log.user_id,
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
}
