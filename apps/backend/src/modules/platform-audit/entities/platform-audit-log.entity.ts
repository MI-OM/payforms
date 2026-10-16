import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Platform-level audit trail (Part 3, Wave A, Module 2).
 *
 * Records actions taken by platform admins (who did what, when, from where).
 * This exists because the tenant `AuditInterceptor` deliberately ignores
 * requests without an `organization_id`, and platform requests have none.
 *
 * Like `platform_users`, this table is intentionally NOT part of the tenant RLS
 * policy set: it carries no `organization_id` and platform operators exist
 * above tenants. It is append-only and never joined into tenant queries.
 */
@Entity('platform_audit_logs')
@Index('IDX_platform_audit_logs_created_at', ['created_at'])
@Index('IDX_platform_audit_logs_actor', ['actor_id', 'created_at'])
@Index('IDX_platform_audit_logs_action', ['action'])
@Index('IDX_platform_audit_logs_resource', ['resource_type', 'resource_id'])
export class PlatformAuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Nullable: some audited events (e.g. a failed login) have no authenticated
  // actor. We still capture the attempt.
  @Column({ type: 'uuid', nullable: true })
  actor_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor_email: string | null;

  @Column({ type: 'varchar', nullable: true })
  actor_role: string | null;

  /** Human-readable label, e.g. "PLATFORM ADMIN LOGIN" or "DISABLE ORGANIZATION". */
  @Column({ type: 'varchar' })
  action: string;

  @Column({ type: 'varchar', nullable: true })
  resource_type: string | null;

  @Column({ type: 'varchar', nullable: true })
  resource_id: string | null;

  @Column({ type: 'varchar' })
  method: string;

  /** Request path without the query string. */
  @Column({ type: 'varchar' })
  path: string;

  @Column({ type: 'int', nullable: true })
  status_code: number | null;

  @Column({ type: 'varchar', nullable: true })
  ip_address: string | null;

  @Column({ type: 'varchar', nullable: true })
  user_agent: string | null;

  /** Sanitised request context (params, query, redacted body, error). */
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
