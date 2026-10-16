import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Append-only history of organization lifecycle-status transitions
 * (Part 3, Wave A, Module 3).
 *
 * Complements the denormalised `organizations.status*` columns: the org row
 * answers "what is the status right now?", this table answers "how did we get
 * here, who did it, and why?".
 *
 * Like `platform_audit_logs`, this is a control-plane table. It carries an
 * `organization_id` but is intentionally NOT part of the tenant RLS policy set
 * (see `EnforceRLSPolicies1777300000000`): it is only ever read/written by
 * platform admin routes, which run in a system context.
 */
@Entity('org_status_events')
@Index('IDX_org_status_events_org_created', ['organization_id', 'created_at'])
@Index('IDX_org_status_events_status', ['new_status'])
export class OrganizationStatusEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar' })
  previous_status: string;

  @Column({ type: 'varchar' })
  new_status: string;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Present when the new status is a time-boxed `suspended`. */
  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  /** Platform admin (`platform_users.id`) who performed the change. */
  @Column({ type: 'uuid', nullable: true })
  actor_platform_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor_email: string | null;

  /** Extra context (e.g. previous effective status, actor role). */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
