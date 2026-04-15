import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { DunningRun } from './dunning-run.entity';
import { Contact } from '../../contact/entities/contact.entity';

/**
 * ArrearsSnapshot entity
 * 
 * Represents a point-in-time capture of a contact's arrears status during a dunning run.
 * Stores the outstanding balance, days overdue, current dunning stage, and related metrics
 * to enable historical tracking and trend analysis of payment delinquency.
 */
@Entity('arrears_snapshots')
export class ArrearsSnapshot {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  run_id: string;

  @Column('uuid')
  contact_id: string;

  /**
   * Outstanding amount for this contact at snapshot time
   */
  @Column('numeric', { precision: 19, scale: 4 })
  outstanding_amount: string;

  /**
   * Number of days this contact has been overdue
   */
  @Column('int')
  days_overdue: number;

  /**
   * Current dunning stage this contact is in (e.g., 0=not started, 1=first notice, 2=second notice, etc.)
   */
  @Column('int', { default: 0 })
  current_stage: number;

  /**
   * Latest status for this contact in dunning workflow: NOT_STARTED, STAGE_1, STAGE_2, ... RESOLVED, EXCLUDED
   */
  @Column('varchar', { length: 50, default: 'NOT_STARTED' })
  status: string;

  /**
   * When the payment/account became delinquent
   */
  @Column('timestamp', { nullable: true })
  delinquency_start_date: Date;

  /**
   * Optional dunning-specific metadata for this contact (e.g., previous notifications sent)
   */
  @Column('jsonb', { default: '{}' })
  metadata: Record<string, any>;

  @CreateDateColumn()
  captured_at: Date;

  @ManyToOne(() => DunningRun, (run) => run.snapshots, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'run_id' })
  run: DunningRun;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;
}
