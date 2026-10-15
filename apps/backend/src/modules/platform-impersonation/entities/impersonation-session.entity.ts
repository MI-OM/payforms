import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { ImpersonationStatus } from '../platform-impersonation.constants';

/**
 * A platform operator's impersonation session (Part 3, Wave B item 9 — IN v1).
 *
 * Control-plane table (carries an `organization_id` and `target_user_id` but is
 * NOT under tenant RLS). Each row is the durable, auditable record behind a
 * short-lived tenant token; the token carries only this row's `id` so a session
 * can be revoked by ending the row.
 *
 * The reason is mandatory and non-nullable: every impersonation must be
 * explainable after the fact.
 */
@Entity('impersonation_sessions')
@Index('IDX_impersonation_sessions_org', ['organization_id'])
@Index('IDX_impersonation_sessions_platform_user', ['platform_user_id'])
@Index('IDX_impersonation_sessions_status', ['status'])
export class ImpersonationSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  platform_user_id: string;

  @Column({ type: 'varchar', length: 320 })
  platform_user_email: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  target_user_id: string;

  @Column({ type: 'varchar', length: 320 })
  target_user_email: string;

  @Column({ type: 'varchar', length: 500 })
  reason: string;

  @Column({ type: 'varchar', default: 'active' })
  status: ImpersonationStatus;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  ended_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  ended_by_platform_user_id: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  ended_by_email: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;
}
