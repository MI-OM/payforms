import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { DunningRun } from './dunning-run.entity';

/**
 * DunningCampaign entity
 * 
 * Represents a dunning campaign configuration for handling payment arrears.
 * Each campaign is organization-scoped and defines the rules, schedule, and
 * progression for sending dunning notifications and escalating delinquent accounts.
 */
@Entity('dunning_campaigns')
export class DunningCampaign {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organization_id: string;

  @Column('varchar', { length: 255 })
  name: string;

  @Column('text', { nullable: true })
    description: string | null;

  /**
   * Campaign status: DRAFT, ACTIVE, PAUSED, COMPLETED, ARCHIVED
   */
  @Column('varchar', { length: 50, default: 'DRAFT' })
  status: string;

  /**
   * Minimum days past due before contact becomes a candidate
   */
  @Column('int', { default: 7 })
  min_days_overdue: number;

  /**
   * Maximum days past due (campaigns target contacts within this range)
   */
  @Column('int', { default: 365 })
  max_days_overdue: number;

  /**
   * Minimum outstanding amount in organization's base currency
   */
  @Column('numeric', { precision: 19, scale: 4, default: '0' })
  min_outstanding_amount: string;

  /**
   * Campaign progression rules encoded as JSON
   * Example: { stages: [{ days: 7, message_template: 'first_notice' }, { days: 14, message_template: 'second_notice' }] }
   */
  @Column('jsonb', { default: '{}' })
  escalation_rules: Record<string, any>;

  /**
   * Optional contact filter criteria encoded as JSON
   * Example: { countries: ['US', 'CA'], forms: [...] }
   */
  @Column('jsonb', { default: '{}' })
  filter_criteria: Record<string, any>;

  /**
   * Frequency: MANUAL, DAILY, WEEKLY, MONTHLY
   */
  @Column('varchar', { length: 50, default: 'MANUAL' })
  execution_frequency: string;

  /**
   * Total number of dunning runs triggered by this campaign
   */
  @Column('int', { default: 0 })
  total_runs: number;

  /**
   * Total outstanding amount at time of last snapshot (denormalized for perf)
   */
  @Column('numeric', { precision: 19, scale: 4, nullable: true })
    total_outstanding_snapshot: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column('timestamp', { nullable: true })
    last_executed_at: Date | null;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => DunningRun, (run) => run.campaign)
  runs: DunningRun[];
}
