import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany, Index } from 'typeorm';
import { User } from '../../auth/entities/user.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { Group } from '../../group/entities/group.entity';
import { Form } from '../../form/entities/form.entity';
import { ActivityLog } from '../../audit/entities/activity-log.entity';
import { PaymentLog } from '../../audit/entities/payment-log.entity';
import { PaymentMethod } from '../../payment/entities/payment.entity';
import { OrganizationStatus } from '../organization-status.constants';

@Entity('organizations')
@Index('IDX_org_email_verification_token', ['email_verification_token'])
@Index('IDX_organizations_subdomain_unique', ['subdomain'], { unique: true, where: '"subdomain" IS NOT NULL' })
@Index('IDX_organizations_custom_domain_unique', ['custom_domain'], { unique: true, where: '"custom_domain" IS NOT NULL' })
@Index('IDX_organizations_status', ['status'])
export class Organization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column()
  email: string;

  @Column({ type: 'boolean', default: false })
  email_verified: boolean;

  @Column({ type: 'varchar', nullable: true })
  email_verification_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  email_verification_expires_at: Date | null;

  @Column({ nullable: true })
  paystack_public_key: string;

  @Column({ nullable: true })
  paystack_secret_key: string;

  @Column({ nullable: true, select: false, insert: false, update: false })
  paystack_webhook_url: string;

  @Column({ nullable: true })
  logo_url: string;

  @Column({ type: 'varchar', nullable: true })
  subdomain: string | null;

  @Column({ type: 'varchar', nullable: true })
  custom_domain: string | null;

  @Column({ type: 'boolean', default: false })
  require_contact_login: boolean;

  @Column({ type: 'boolean', default: true })
  notify_submission_confirmation: boolean;

  @Column({ type: 'boolean', default: true })
  notify_payment_confirmation: boolean;

  @Column({ type: 'boolean', default: true })
  notify_payment_failure: boolean;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  partial_payment_limit: number | null;

  @Column({ type: 'varchar', array: true, default: () => "ARRAY['ONLINE']::varchar[]" })
  enabled_payment_methods: PaymentMethod[];

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  market_readiness_flags: Record<string, boolean>;

  @Column({ type: 'varchar', default: 'free' })
  billing_plan_tier: string;

  // --- Lifecycle status (Part 3, Module 3) -----------------------------------
  // Drives the platform "hard stop": suspended/disabled blocks tenant login and
  // public payment forms. Denormalised onto the org for fast enforcement; the
  // full transition history lives in `org_status_events`.
  @Column({ 
    type: 'enum', 
    enum: ['active', 'suspended', 'disabled'],
    default: 'active' 
  })
  status: OrganizationStatus;

  @Column({ type: 'text', nullable: true })
  status_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  status_changed_at: Date | null;

  /** Platform admin (`platform_users.id`) who last changed the status. */
  @Column({ type: 'uuid', nullable: true })
  status_changed_by: string | null;

  /** When set on a `suspended` org, the hard stop lifts automatically after this. */
  @Column({ type: 'timestamp', nullable: true })
  suspended_until: Date | null;

  @Column({ type: 'integer', nullable: true, default: 1095 })
  data_retention_contact_days: number;

  @Column({ type: 'integer', nullable: true, default: 2555 })
  data_retention_submission_days: number;

  @Column({ type: 'integer', nullable: true, default: 2555 })
  data_retention_audit_days: number;

  @Column({ type: 'boolean', default: true })
  auto_purge_retention_enabled: boolean;

  @Column({ type: 'timestamp', nullable: true })
  last_data_retention_purge_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @OneToMany(() => User, user => user.organization)
  users: User[];

  @OneToMany(() => Contact, contact => contact.organization)
  contacts: Contact[];

  @OneToMany(() => Group, group => group.organization)
  groups: Group[];

  @OneToMany(() => Form, form => form.organization)
  forms: Form[];

  @OneToMany(() => ActivityLog, log => log.organization)
  activity_logs: ActivityLog[];

  @OneToMany(() => PaymentLog, log => log.organization)
  payment_logs: PaymentLog[];
}
