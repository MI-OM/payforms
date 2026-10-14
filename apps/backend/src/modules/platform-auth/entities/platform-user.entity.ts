import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

/**
 * Platform-level operator account.
 *
 * This is deliberately NOT an `organization_id` scoped table: platform admins
 * sit *above* tenants, so `platform_users` is intentionally excluded from the
 * tenant RLS policy list (see `EnforceRLSPolicies1777300000000`). Access is
 * gated at the application layer by the dedicated `platform-jwt` strategy and
 * `PlatformJwtAuthGuard`, which use a secret distinct from the tenant JWT
 * secret so a tenant token can never be replayed here (or vice versa).
 */
export type PlatformRole = 'SUPER' | 'SUPPORT' | 'BILLING';

@Entity('platform_users')
@Index('IDX_platform_users_email_unique', ['email'], { unique: true })
export class PlatformUser {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  email: string;

  @Column()
  password_hash: string;

  // Single 'SUPER' role for now (decision 2026-10-14). The union above already
  // reserves SUPPORT/BILLING so splitting permissions later needs no migration.
  @Column({ type: 'varchar', default: 'SUPER' })
  role: PlatformRole;

  @Column({ type: 'varchar', nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  last_name: string | null;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_login_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  refresh_token_hash: string | null;

  // Two-factor auth is intentionally deferred (plan §9). The columns are
  // reserved now so enabling it later needs no schema change.
  @Column({ type: 'boolean', default: false, select: false })
  two_factor_enabled: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  two_factor_secret: string | null;

  @CreateDateColumn()
  created_at: Date;
}
