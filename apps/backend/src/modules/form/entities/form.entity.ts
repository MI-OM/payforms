import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, ManyToMany, Index, JoinTable } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { FormField } from './form-field.entity';
import { Group } from '../../group/entities/group.entity';
import { FormTarget } from './form-target.entity';

@Entity('forms')
@Index(['organization_id', 'slug'], { unique: true })
@Index('IDX_forms_org_created_at', ['organization_id', 'created_at'])
@Index('IDX_forms_org_is_active', ['organization_id', 'is_active'])
export class Form {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  title: string;

  @Column({ type: 'varchar', nullable: true })
  category: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column()
  slug: string;

  @Column({ type: 'varchar', enum: ['FIXED', 'VARIABLE'], default: 'FIXED' })
  payment_type: 'FIXED' | 'VARIABLE';

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  amount: number;

  @Column({ type: 'varchar', enum: ['OPEN', 'LOGIN_REQUIRED', 'TARGETED_ONLY'], default: 'OPEN' })
  access_mode: 'OPEN' | 'LOGIN_REQUIRED' | 'TARGETED_ONLY';

  @Column({ type: 'varchar', enum: ['NONE', 'CONTACT_EMAIL', 'CONTACT_EXTERNAL_ID'], default: 'NONE' })
  identity_validation_mode: 'NONE' | 'CONTACT_EMAIL' | 'CONTACT_EXTERNAL_ID';

  @Column({ type: 'varchar', nullable: true })
  identity_field_label: string | null;

  @Column({ type: 'boolean', default: false })
  allow_partial: boolean;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.forms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => FormField, field => field.form, { cascade: true })
  fields: FormField[];

  @ManyToMany(() => Group)
  @JoinTable({
    name: 'form_groups',
    joinColumn: { name: 'form_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'group_id', referencedColumnName: 'id' },
  })
  groups: Group[];

  @OneToMany(() => FormTarget, target => target.form, { cascade: true })
  targets: FormTarget[];
}
