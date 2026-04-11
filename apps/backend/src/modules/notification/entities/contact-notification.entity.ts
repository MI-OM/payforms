import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('contact_notifications')
@Index('IDX_contact_notifications_org_created_at', ['organization_id', 'created_at'])
export class ContactNotification {
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

  @Column({ type: 'varchar', default: 'GENERAL' })
  type: string;

  @Column({ type: 'varchar', enum: ['ALL_CONTACTS', 'SELECTED_CONTACTS'], default: 'ALL_CONTACTS' })
  audience_type: 'ALL_CONTACTS' | 'SELECTED_CONTACTS';

  @Column({ type: 'uuid', array: true, nullable: true })
  target_contact_ids: string[] | null;

  @Column({ type: 'uuid', array: true, default: () => 'ARRAY[]::uuid[]' })
  read_by_contact_ids: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  created_at: Date;
}
