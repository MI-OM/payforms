import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('internal_notifications')
@Index('IDX_internal_notifications_org_created_at', ['organization_id', 'created_at'])
export class InternalNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @Column()
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', enum: ['ALL_USERS', 'SELECTED_USERS'], default: 'ALL_USERS' })
  audience_type: 'ALL_USERS' | 'SELECTED_USERS';

  @Column({ type: 'uuid', array: true, nullable: true })
  target_user_ids: string[] | null;

  @Column({ type: 'uuid', array: true, default: () => 'ARRAY[]::uuid[]' })
  read_by_user_ids: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}