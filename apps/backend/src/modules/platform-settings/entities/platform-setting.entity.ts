import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PlatformSettingValueType } from '../platform-settings.constants';

/**
 * A typed, global platform setting (Part 3, Wave A, Module 5).
 *
 * Control-plane table: not scoped to a tenant and intentionally excluded from
 * the tenant RLS policy set. Only platform routes touch it.
 *
 * Values marked `is_secret` are never returned by the API — reads expose
 * `has_value` instead, mirroring how `paystack_secret_key` is handled.
 */
@Entity('platform_settings')
@Index('IDX_platform_settings_key', ['key'], { unique: true })
@Index('IDX_platform_settings_category', ['category'])
export class PlatformSetting {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  key: string;

  @Column({ type: 'jsonb', nullable: true })
  value: any;

  @Column({ type: 'varchar', default: 'json' })
  value_type: PlatformSettingValueType;

  @Column({ type: 'varchar', default: 'GENERAL' })
  category: string;

  @Column({ type: 'varchar', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  is_secret: boolean;

  @Column({ type: 'uuid', nullable: true })
  updated_by_platform_user_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  updated_by_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
