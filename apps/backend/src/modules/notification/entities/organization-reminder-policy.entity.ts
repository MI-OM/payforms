import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { ReminderSendHistory } from './reminder-send-history.entity';

/**
 * Trigger condition for when reminders should be sent.
 */
export interface ReminderTriggerConfig {
  /**
   * Minimum balance due amount (in currency units, e.g., 5000 means ₦5,000).
   * Reminder only sent if contact's balance_due >= this value.
   */
  balance_due_threshold: number;

  /**
   * Minimum number of days overdue.
   * Reminder only sent if (today - last_full_payment_date) >= this many days.
   */
  days_overdue_threshold: number;
}

/**
 * Configuration for who should receive reminders.
 */
export interface ReminderRecipientConfig {
  /**
   * Recipient selection type.
   * - "all_with_balance_due": send to all contacts in org with outstanding balance
   * - "specific_groups": send to contacts in specific group(s)
   */
  type: 'all_with_balance_due' | 'specific_groups';

  /**
   * Group IDs (only used if type === 'specific_groups').
   */
  group_ids?: string[];
}

@Entity('organization_reminder_policies')
@Index(['organization_id', 'is_enabled'])
@Index(['organization_id', 'created_at'])
export class OrganizationReminderPolicy {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organization_id: string;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  /**
   * Whether this policy is active and should be evaluated by the reminder scheduler.
   */
  @Column('boolean', { default: true })
  is_enabled: boolean;

  /**
   * Trigger conditions (balance_due_threshold, days_overdue_threshold).
   */
  @Column('jsonb', { default: () => "'{}'" })
  trigger_config: ReminderTriggerConfig;

  /**
   * Recipient selection config (who should receive reminders).
   */
  @Column('jsonb', { default: () => "'{\"type\": \"all_with_balance_due\"}'" })
  recipient_config: ReminderRecipientConfig;

  /**
   * Message template for reminders.
   * Supports placeholders:
   * - {{contact_first_name}}: Contact's first name
   * - {{contact_full_name}}: Contact's full name
   * - {{balance_due}}: Outstanding balance amount
   * - {{days_overdue}}: Number of days overdue
   * - {{organization_name}}: Organization name
   * - {{form_name}}: Form name (if reminder is form-specific)
   *
   * Example:
   * "Dear {{contact_first_name}}, you have an outstanding balance of {{balance_due}} for {{days_overdue}} days. Please pay at your earliest convenience."
   */
  @Column('text')
  message_template: string;

  /**
   * Cooldown period in days.
   * Prevents sending multiple reminders to the same contact within this many days.
   * Default: 7 days (send at most once per week per contact).
   */
  @Column('integer', { default: 7 })
  cooldown_days: number;

  /**
   * When this policy was last evaluated by the scheduler.
   * Used for scheduling and troubleshooting.
   */
  @Column('timestamp', { nullable: true })
  last_executed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => ReminderSendHistory, history => history.policy)
  send_history: ReminderSendHistory[];
}
