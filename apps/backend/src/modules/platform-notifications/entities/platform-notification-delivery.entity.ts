import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-recipient send result for a `PlatformNotification`
 * (Part 3, Wave A, Module 4).
 *
 * One row per attempted recipient so a broadcast can be audited and retried
 * precisely. Control-plane table: carries an optional `organization_id` but is
 * excluded from the tenant RLS policy set.
 */
export type PlatformNotificationDeliveryStatus = 'sent' | 'failed' | 'skipped';

@Entity('platform_notification_deliveries')
@Index('IDX_platform_notification_deliveries_notification', ['notification_id'])
@Index('IDX_platform_notification_deliveries_notification_status', [
  'notification_id',
  'status',
])
@Index('IDX_platform_notification_deliveries_org', ['organization_id'])
export class PlatformNotificationDelivery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  notification_id: string;

  @Column({ type: 'uuid', nullable: true })
  organization_id: string | null;

  @Column()
  recipient_email: string;

  @Column({ type: 'uuid', nullable: true })
  recipient_user_id: string | null;

  @Column({ type: 'varchar' })
  status: PlatformNotificationDeliveryStatus;

  /** Populated when `status` is `failed`. */
  @Column({ type: 'text', nullable: true })
  error: string | null;

  @Column({ type: 'timestamp', nullable: true })
  sent_at: Date | null;

  @CreateDateColumn()
  created_at: Date;
}
