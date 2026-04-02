import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, ManyToMany, OneToMany, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Contact } from '../../contact/entities/contact.entity';

@Entity('groups')
@Index(['organization_id', 'name'], { unique: true })
@Index('IDX_groups_org_parent', ['organization_id', 'parent_group_id'])
export class Group {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'uuid', nullable: true })
  parent_group_id: string | null;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.groups, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Group, group => group.children, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'parent_group_id' })
  parent_group: Group;

  @OneToMany(() => Group, group => group.parent_group)
  children: Group[];

  @ManyToMany(() => Contact, contact => contact.groups)
  contacts: Contact[];
}
