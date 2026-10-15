import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Per-organization override of a feature flag (Part 3, Wave A, Module 5).
 *
 * When a row exists for `(flag_key, organization_id)` its `enabled` value wins
 * over the flag's global default. `reason` records why the tenant was granted
 * or denied the flag, so access decisions are explainable during support.
 *
 * Control-plane table (carries an `organization_id` but is NOT under tenant RLS).
 */
@Entity('platform_feature_flag_overrides')
@Index(
  'IDX_platform_feature_flag_overrides_flag_org',
  ['flag_key', 'organization_id'],
  { unique: true },
)
@Index('IDX_platform_feature_flag_overrides_org', ['organization_id'])
export class PlatformFeatureFlagOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  flag_key: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'boolean' })
  enabled: boolean;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by_platform_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
