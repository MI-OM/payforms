import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { OrganizationReminderPolicy } from './organization-reminder-policy.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { Organization } from '../../organization/entities/organization.entity';

/**
 * Immutable audit trail of reminder sends.
 *
 * Purpose:
 * - Track which reminders were sent to which contacts and when
 * - Enforce cooldown (don't send same contact within N days)
 * - Provide compliance audit trail (historical record of all reminders)
 * - Troubleshoot failed sends
 *
 * Lifecycle:
 * - Created when a reminder is sent (success or failure)
 * - Never updated (immutable)
 * - Retained for audit and reporting
 */
@Entity('reminder_send_history')
@Index(['policy_id'])
@Index(['contact_id'])
@Index(['organization_id', 'contact_id', 'sent_at'])
export class ReminderSendHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the policy that triggered this reminder.
   * Cascade delete: deleting a policy also deletes its send history.
   */
  @Column('uuid')
  policy_id: string;

  /**
   * Organization that owns this reminder history.
   * Denormalized for fast queries without joins.
   */
  @Column('uuid')
  organization_id: string;

  /**
   * Contact who received the reminder.
   */
  @Column('uuid')
  contact_id: string;

  /**
   * Email address the reminder was sent to.
   * Denormalized here for audit trail (in case contact email changes later).
   */
  @Column('varchar')
  recipient_email: string;

  /**
   * The actual message sent (with placeholders filled in).
   * Immutable record of what was communicated.
   */
  @Column('text')
  message_sent: string;

  /**
   * Outstanding balance at time of send.
   * Preserved for historical context and auditing.
   */
  @Column('decimal', { precision: 12, scale: 2, nullable: true })
  balance_due_at_send: number | null;

  /**
   * Number of days overdue at time of send.
   * Calculated as: (today - last_full_payment_date).
   */
  @Column('integer', { nullable: true })
  days_overdue_at_send: number | null;

  /**
   * Send status: 'sent' (success), 'failed' (network/service error), 'bounced' (email provider rejected).
   */
  @Column({ type: 'varchar', enum: ['sent', 'failed', 'bounced'], default: 'sent' })
  send_status: 'sent' | 'failed' | 'bounced';

  /**
   * Error details if send failed.
   * Example: "SMTP 550: Mailbox does not exist" or "Email provider rate limit exceeded".
   */
  @Column('text', { nullable: true })
  error_message: string | null;

  @CreateDateColumn()
  sent_at: Date;

  // Relations
  @ManyToOne(() => OrganizationReminderPolicy, policy => policy.send_history, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'policy_id' })
  policy: OrganizationReminderPolicy;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
