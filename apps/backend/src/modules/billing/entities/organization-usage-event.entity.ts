import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Append-only usage ledger for the two metered resources that cannot be derived
 * from an existing table.
 *
 * Every other billing metric is a live `COUNT(*)` over a tenant table
 * (`forms`, `contacts`, `users`, `submissions`). Email sends and storage bytes
 * have no such table, so they are recorded here as they happen and summed per
 * calendar month (email) or all-time (storage) to resolve the organization's
 * usage. Without this, `monthly_email_sends` and `storage_gb` limits would stay
 * cosmetic no matter how many call sites enforce them.
 *
 * Tenant table: covered by the `organization_usage_events_org_isolation` RLS
 * policy added in `AddOrganizationUsageEvents1777920000000`.
 */
@Entity('organization_usage_events')
@Index('IDX_org_usage_events_org_metric_created', ['organization_id', 'metric', 'created_at'])
export class OrganizationUsageEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  /** Billing metric this event consumes. Mirrors a `PlanLimits` key. */
  @Column({ type: 'varchar', length: 40 })
  metric: 'EMAIL_SEND' | 'STORAGE_BYTES';

  /**
   * Amount consumed in the metric's natural unit: recipient count for
   * `EMAIL_SEND`, bytes for `STORAGE_BYTES`. `bigint` because stored bytes
   * exceed the 32-bit `int` range; TypeORM returns it as a string.
   */
  @Column({ type: 'bigint' })
  amount: string;

  /** Short human-readable context (subject line, object path). Never PII-heavy. */
  @Column({ type: 'varchar', length: 200, nullable: true })
  note: string | null;

  @CreateDateColumn()
  created_at: Date;
}
