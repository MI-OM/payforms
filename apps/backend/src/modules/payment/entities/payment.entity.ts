import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Submission } from '../../submission/entities/submission.entity';

@Entity('payments')
@Index(['organization_id', 'reference'], { unique: true })
@Index(['organization_id', 'status'])
@Index('IDX_payments_org_created_at', ['organization_id', 'created_at'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  submission_id: string;

  @Column()
  organization_id: string;

  @Column()
  reference: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED'], default: 'PENDING' })
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';

  @Column({ nullable: true })
  paid_at: Date;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.activity_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Submission, submission => submission.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: Submission;
}
