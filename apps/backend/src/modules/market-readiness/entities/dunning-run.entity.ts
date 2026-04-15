import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { DunningCampaign } from './dunning-campaign.entity';
import { ArrearsSnapshot } from './arrears-snapshot.entity';

/**
 * DunningRun entity
 * 
 * Represents a single execution instance of a dunning campaign.
 * Tracks metrics: how many contacts were evaluated, how many notifications sent,
 * total outstanding amount at time of run, etc.
 */
@Entity('dunning_runs')
export class DunningRun {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  campaign_id: string;

  /**
   * Run status: SCHEDULED, IN_PROGRESS, COMPLETED, FAILED, CANCELLED
   */
  @Column('varchar', { length: 50, default: 'SCHEDULED' })
  status: string;

  /**
   * When scheduled execution should/did begin
   */
  @Column('timestamp', { nullable: true })
  scheduled_for: Date;

  /**
   * When execution actually started
   */
  @Column('timestamp', { nullable: true })
  started_at: Date;

  /**
   * When execution completed (success or failure)
   */
  @Column('timestamp', { nullable: true })
  completed_at: Date;

  /**
   * Total contacts evaluated in this run
   */
  @Column('int', { default: 0 })
  contacts_evaluated: number;

  /**
   * Contacts moved to next dunning stage
   */
  @Column('int', { default: 0 })
  contacts_escalated: number;

  /**
   * Notification/message records created in this run
   */
  @Column('int', { default: 0 })
  notifications_sent: number;

  /**
   * Total outstanding amount across evaluated contacts
   */
  @Column('numeric', { precision: 19, scale: 4, default: '0' })
  total_outstanding: string;

  /**
   * Summary of run result encoded as JSON
   * Example: { stage_breakdowns: { '7': 150, '14': 45, '30': 12 }, exception_count: 3 }
   */
  @Column('jsonb', { default: '{}' })
  summary: Record<string, any>;

  /**
   * Optional error message if run failed
   */
  @Column('text', { nullable: true })
  error_message: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => DunningCampaign, (campaign) => campaign.runs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'campaign_id' })
  campaign: DunningCampaign;

  @OneToMany(() => ArrearsSnapshot, (snapshot) => snapshot.run)
  snapshots: ArrearsSnapshot[];
}
