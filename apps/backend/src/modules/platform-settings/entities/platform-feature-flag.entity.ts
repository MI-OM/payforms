import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * A named feature flag with a global default (Part 3, Wave A, Module 5).
 *
 * The global `enabled` value applies unless an organization-specific override
 * exists (see `PlatformFeatureFlagOverride`). Control-plane table, excluded
 * from tenant RLS.
 */
@Entity('platform_feature_flags')
@Index('IDX_platform_feature_flags_key', ['key'], { unique: true })
export class PlatformFeatureFlag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @Column({ type: 'uuid', nullable: true })
  updated_by_platform_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
