import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository, SelectQueryBuilder } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationStatus } from '../organization/organization-status.constants';
import { User } from '../auth/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import {
  PlatformNotification,
  PlatformNotificationSegment,
  PlatformNotificationStatus,
} from './entities/platform-notification.entity';
import {
  PlatformNotificationDelivery,
  PlatformNotificationDeliveryStatus,
} from './entities/platform-notification-delivery.entity';
import {
  ComposePlatformNotificationDto,
  ListPlatformNotificationDeliveriesQueryDto,
  ListPlatformNotificationsQueryDto,
  NotifyOrganizationDto,
} from './dto/platform-notifications.dto';

export interface PlatformActor {
  id?: string | null;
  email?: string | null;
  role?: string | null;
}

interface ResolvedRecipient {
  organization_id: string;
  email: string;
  user_id: string | null;
}

interface DeliveryOutcome {
  sent: number;
  failed: number;
  skipped: number;
  status: PlatformNotificationStatus;
}

const DELIVERY_INSERT_CHUNK = 500;
const ERROR_MESSAGE_MAX = 500;

/**
 * Backs the platform admin notifications composer (Part 3, Wave A, Module 4).
 *
 * A platform operator can broadcast to every organization, to a segment
 * (plan/status) or to a single organization (the `notify` action deferred from
 * Module 3). Each send is recorded once in `platform_notifications` and once
 * per recipient in `platform_notification_deliveries`, so a broadcast is fully
 * auditable and can be retried surgically.
 *
 * Email is delivered through the existing tenant `NotificationService`, one
 * recipient at a time, so a single bad address cannot abort the whole run.
 * `dry_run` resolves and records recipients without sending anything.
 */
@Injectable()
export class PlatformNotificationsService {
  constructor(
    @InjectRepository(PlatformNotification)
    private readonly notificationRepository: Repository<PlatformNotification>,
    @InjectRepository(PlatformNotificationDelivery)
    private readonly deliveryRepository: Repository<PlatformNotificationDelivery>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly emailService: NotificationService,
  ) {}

  async compose(dto: ComposePlatformNotificationDto, actor: PlatformActor) {
    if (dto.audience_type === 'SEGMENT' && !dto.segment) {
      throw new BadRequestException('segment is required when audience_type is SEGMENT');
    }

    const organizations = await this.resolveOrganizations(dto.audience_type, dto.segment);

    const notification = this.notificationRepository.create({
      subject: dto.subject,
      body: dto.body,
      channel: 'EMAIL',
      audience_type: dto.audience_type,
      segment: dto.segment ?? null,
      organization_id: null,
      status: 'queued',
      total_recipients: 0,
      created_by_platform_user_id: actor?.id ?? null,
      created_by_email: actor?.email ?? null,
      metadata: {
        matched_organizations: organizations.length,
        dry_run: dto.dry_run === true,
        actor_role: actor?.role ?? null,
      },
    });
    const saved = await this.notificationRepository.save(notification);

    const recipients = await this.resolveRecipients(organizations);
    const outcome = await this.deliver(saved, recipients, dto.dry_run === true);

    return this.buildResult(saved, recipients, outcome, dto.dry_run === true);
  }

  async notifyOrganization(
    organizationId: string,
    dto: NotifyOrganizationDto,
    actor: PlatformActor,
  ) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const notification = this.notificationRepository.create({
      subject: dto.subject,
      body: dto.body,
      channel: 'EMAIL',
      audience_type: 'ORGANIZATION',
      segment: null,
      organization_id: organization.id,
      status: 'queued',
      total_recipients: 0,
      created_by_platform_user_id: actor?.id ?? null,
      created_by_email: actor?.email ?? null,
      metadata: {
        matched_organizations: 1,
        dry_run: dto.dry_run === true,
        actor_role: actor?.role ?? null,
      },
    });
    const saved = await this.notificationRepository.save(notification);

    const recipients = await this.resolveRecipients([organization]);
    const outcome = await this.deliver(saved, recipients, dto.dry_run === true);

    return this.buildResult(saved, recipients, outcome, dto.dry_run === true);
  }

  async list(query: ListPlatformNotificationsQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 100) : 20;

    const qb = this.notificationRepository.createQueryBuilder('notification');

    if (query.status) {
      qb.andWhere('notification.status = :status', { status: query.status });
    }
    if (query.audience_type) {
      qb.andWhere('notification.audience_type = :audienceType', {
        audienceType: query.audience_type,
      });
    }
    if (query.search) {
      const keyword = `%${query.search}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('notification.subject ILIKE :keyword', { keyword }).orWhere(
            'notification.body ILIKE :keyword',
            { keyword },
          );
        }),
      );
    }
    if (query.from) {
      qb.andWhere('notification.created_at >= :from', { from: new Date(query.from) });
    }
    if (query.to) {
      qb.andWhere('notification.created_at <= :to', { to: new Date(query.to) });
    }

    qb.orderBy('notification.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      data: rows.map((row) => this.toSummary(row)),
      total,
      page,
      limit,
    };
  }

  async detail(notificationId: string, query: ListPlatformNotificationDeliveriesQueryDto) {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    const page = query.page && query.page > 0 ? query.page : 1;
    const limit = query.limit && query.limit > 0 ? Math.min(query.limit, 200) : 50;

    const where: Record<string, any> = { notification_id: notificationId };
    if (query.status) {
      where.status = query.status;
    }

    const [deliveries, total] = await this.deliveryRepository.findAndCount({
      where,
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      notification: this.toSummary(notification),
      deliveries: {
        data: deliveries.map((delivery) => this.toDelivery(delivery)),
        total,
        page,
        limit,
      },
    };
  }

  // --- internals ------------------------------------------------------------

  private async resolveOrganizations(
    audienceType: ComposePlatformNotificationDto['audience_type'],
    segment?: PlatformNotificationSegment,
  ): Promise<Organization[]> {
    const qb = this.organizationRepository.createQueryBuilder('org');

    if (audienceType === 'SEGMENT' && segment) {
      if (segment.plan) {
        qb.andWhere('org.billing_plan_tier = :plan', { plan: segment.plan.toLowerCase() });
      }
      if (segment.status) {
        this.applySegmentStatusFilter(qb, segment.status);
      }
    }

    qb.orderBy('org.created_at', 'ASC');
    return qb.getMany();
  }

  private async resolveRecipients(organizations: Organization[]): Promise<ResolvedRecipient[]> {
    if (!organizations.length) {
      return [];
    }

    const organizationIds = organizations.map((org) => org.id);
    const admins = await this.userRepository.find({
      where: {
        organization_id: In(organizationIds),
        role: 'ADMIN',
        is_active: true,
      },
      select: ['id', 'email', 'organization_id'],
    });

    const adminsByOrg = new Map<string, Array<{ id: string; email: string | null }>>();
    for (const admin of admins) {
      const bucket = adminsByOrg.get(admin.organization_id) ?? [];
      bucket.push({ id: admin.id, email: admin.email });
      adminsByOrg.set(admin.organization_id, bucket);
    }

    const recipients: ResolvedRecipient[] = [];
    for (const org of organizations) {
      const orgAdmins = adminsByOrg.get(org.id) ?? [];
      const seen = new Set<string>();

      for (const admin of orgAdmins) {
        const email = admin.email?.trim().toLowerCase();
        if (!email || seen.has(email)) {
          continue;
        }
        seen.add(email);
        recipients.push({ organization_id: org.id, email, user_id: admin.id });
      }

      // Fall back to the organization's own billing/contact email when the org
      // has no active ADMIN user (e.g. a brand new or fully deactivated tenant).
      if (!seen.size) {
        const email = org.email?.trim().toLowerCase();
        if (email) {
          recipients.push({ organization_id: org.id, email, user_id: null });
        }
      }
    }

    return recipients;
  }

  private async deliver(
    notification: PlatformNotification,
    recipients: ResolvedRecipient[],
    dryRun: boolean,
  ): Promise<DeliveryOutcome> {
    const html = this.renderHtml(notification);
    const rows: Array<Partial<PlatformNotificationDelivery>> = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const recipient of recipients) {
      if (dryRun) {
        skipped += 1;
        rows.push(this.buildDeliveryRow(notification, recipient, 'skipped', null));
        continue;
      }

      try {
        await this.emailService.sendEmail([recipient.email], notification.subject, html);
        sent += 1;
        rows.push(this.buildDeliveryRow(notification, recipient, 'sent', null));
      } catch (error) {
        failed += 1;
        rows.push(
          this.buildDeliveryRow(notification, recipient, 'failed', this.errorMessage(error)),
        );
      }
    }

    for (let i = 0; i < rows.length; i += DELIVERY_INSERT_CHUNK) {
      await this.deliveryRepository.insert(rows.slice(i, i + DELIVERY_INSERT_CHUNK));
    }

    const status: PlatformNotificationStatus = dryRun
      ? 'dry_run'
      : recipients.length === 0
        ? 'failed'
        : failed === 0
          ? 'sent'
          : sent === 0
            ? 'failed'
            : 'partial';

    notification.total_recipients = recipients.length;
    notification.sent_count = sent;
    notification.failed_count = failed;
    notification.skipped_count = skipped;
    notification.status = status;
    await this.notificationRepository.save(notification);

    return { sent, failed, skipped, status };
  }

  private buildDeliveryRow(
    notification: PlatformNotification,
    recipient: ResolvedRecipient,
    status: PlatformNotificationDeliveryStatus,
    error: string | null,
  ): Partial<PlatformNotificationDelivery> {
    return {
      notification_id: notification.id,
      organization_id: recipient.organization_id,
      recipient_email: recipient.email,
      recipient_user_id: recipient.user_id,
      status,
      error,
      sent_at: status === 'sent' ? new Date() : null,
    };
  }

  private renderHtml(notification: PlatformNotification): string {
    return [
      '<!doctype html><html><body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">',
      notification.body,
      '<hr style="margin-top:32px;border:none;border-top:1px solid #e5e7eb" />',
      '<p style="font-size:12px;color:#6b7280">This message was sent by the Payforms platform team.</p>',
      '</body></html>',
    ].join('');
  }

  private errorMessage(error: any): string {
    const raw =
      error?.response?.data?.message ??
      error?.message ??
      (typeof error === 'string' ? error : 'Failed to send email');
    const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
    return message.slice(0, ERROR_MESSAGE_MAX);
  }

  private applySegmentStatusFilter(
    qb: SelectQueryBuilder<Organization>,
    status: OrganizationStatus,
  ): void {
    // Mirrors PlatformOrganizationsService.applyStatusFilter: `suspended` with an
    // elapsed expiry is effectively `active` again, so the segment must respect
    // the same effective-status rules as the console.
    const now = new Date();
    if (status === 'disabled') {
      qb.andWhere('org.status = :segmentDisabled', { segmentDisabled: 'disabled' });
      return;
    }
    if (status === 'suspended') {
      qb.andWhere(
        `org.status = 'suspended' AND (org.suspended_until IS NULL OR org.suspended_until > :segmentNow)`,
        { segmentNow: now },
      );
      return;
    }
    qb.andWhere(
      `(org.status = 'active' OR (org.status = 'suspended' AND org.suspended_until IS NOT NULL AND org.suspended_until <= :segmentNow))`,
      { segmentNow: now },
    );
  }

  private buildResult(
    notification: PlatformNotification,
    recipients: ResolvedRecipient[],
    outcome: DeliveryOutcome,
    dryRun: boolean,
  ) {
    return {
      notification: this.toSummary(notification),
      delivery: {
        total: recipients.length,
        sent: outcome.sent,
        failed: outcome.failed,
        skipped: outcome.skipped,
      },
      recipients: dryRun
        ? recipients.map((recipient) => ({
            organization_id: recipient.organization_id,
            email: recipient.email,
          }))
        : undefined,
    };
  }

  private toSummary(notification: PlatformNotification) {
    return {
      id: notification.id,
      subject: notification.subject,
      channel: notification.channel,
      audience_type: notification.audience_type,
      segment: notification.segment ?? null,
      organization_id: notification.organization_id ?? null,
      status: notification.status,
      total_recipients: notification.total_recipients,
      sent_count: notification.sent_count,
      failed_count: notification.failed_count,
      skipped_count: notification.skipped_count,
      created_by_platform_user_id: notification.created_by_platform_user_id ?? null,
      created_by_email: notification.created_by_email ?? null,
      metadata: notification.metadata ?? null,
      created_at: notification.created_at,
    };
  }

  private toDelivery(delivery: PlatformNotificationDelivery) {
    return {
      id: delivery.id,
      notification_id: delivery.notification_id,
      organization_id: delivery.organization_id ?? null,
      recipient_email: delivery.recipient_email,
      recipient_user_id: delivery.recipient_user_id ?? null,
      status: delivery.status,
      error: delivery.error ?? null,
      sent_at: delivery.sent_at ?? null,
      created_at: delivery.created_at,
    };
  }
}
