import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { OrganizationStatus } from '../../organization/organization-status.constants';

/**
 * A platform-admin broadcast / targeted notification (Part 3, Wave A, Module 4).
 *
 * This is the *record* of what a platform operator sent to tenants, not the
 * per-recipient send result (that lives in `platform_notification_deliveries`).
 *
 * Like `platform_users` / `platform_audit_logs` this is a control-plane table:
 * it carries an optional `organization_id` but is intentionally NOT part of the
 * tenant RLS policy set (only platform routes touch it, in a system context).
 */
export type PlatformNotificationAudienceType = 'ALL' | 'SEGMENT' | 'ORGANIZATION';
export type PlatformNotificationStatus =
  | 'queued'
  | 'sent'
  | 'partial'
  | 'failed'
  | 'dry_run';

export interface PlatformNotificationSegment {
  plan?: string;
  status?: OrganizationStatus;
}

@Entity('platform_notifications')
@Index('IDX_platform_notifications_created_at', ['created_at'])
@Index('IDX_platform_notifications_status', ['status'])
@Index('IDX_platform_notifications_audience', ['audience_type'])
export class PlatformNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  subject: string;

  /** HTML body authored by the platform operator. */
  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', default: 'EMAIL' })
  channel: string;

  @Column({ type: 'varchar' })
  audience_type: PlatformNotificationAudienceType;

  /** Present when `audience_type` is `SEGMENT`. */
  @Column({ type: 'jsonb', nullable: true })
  segment: PlatformNotificationSegment | null;

  /** Present when `audience_type` is `ORGANIZATION`. */
  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column({ type: 'varchar', default: 'queued' })
  status: PlatformNotificationStatus;

  @Column({ type: 'int', default: 0 })
  total_recipients: number;

  @Column({ type: 'int', default: 0 })
  sent_count: number;

  @Column({ type: 'int', default: 0 })
  failed_count: number;

  @Column({ type: 'int', default: 0 })
  skipped_count: number;

  @Column({ type: 'uuid', nullable: true })
  created_by_platform_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  created_by_email: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
