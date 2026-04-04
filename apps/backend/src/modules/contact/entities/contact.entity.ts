import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, JoinTable, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Group } from '../../group/entities/group.entity';

@Entity('contacts')
@Index(['organization_id', 'email'], { unique: true })
@Index('IDX_contacts_org_created_at', ['organization_id', 'created_at'])
@Index('IDX_contacts_password_reset_token', ['password_reset_token'])
export class Contact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ nullable: true })
  first_name: string | null;

  @Column({ nullable: true })
  middle_name: string | null;

  @Column({ nullable: true })
  last_name: string | null;

  @Column({ nullable: true })
  email: string | null;

  @Column({ nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', nullable: true })
  gender: string | null;

  @Column({ nullable: true })
  student_id: string | null;

  @Column({ nullable: true })
  external_id: string | null;

  @Column({ nullable: true })
  guardian_name: string | null;

  @Column({ nullable: true })
  guardian_email: string | null;

  @Column({ nullable: true })
  guardian_phone: string | null;

  @Column({ nullable: true })
  password_hash: string | null;

  @Column({ type: 'boolean', default: false })
  is_active: boolean;

  @Column({ type: 'boolean', default: true })
  must_reset_password: boolean;

  @Column({ type: 'varchar', nullable: true })
  password_reset_token: string | null;

  @Column({ nullable: true, type: 'timestamp' })
  password_reset_expires_at: Date | null;

  @Column({ nullable: true, type: 'timestamp' })
  token_invalidated_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Organization, org => org.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToMany(() => Group, group => group.contacts)
  @JoinTable({
    name: 'contact_groups',
    joinColumn: { name: 'contact_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'group_id', referencedColumnName: 'id' },
  })
  groups: Group[];
}
