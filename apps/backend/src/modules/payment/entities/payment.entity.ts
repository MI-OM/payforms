import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Submission } from '../../submission/entities/submission.entity';

export const PAYMENT_METHODS = ['ONLINE', 'CASH', 'BANK_TRANSFER', 'POS', 'CHEQUE'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

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

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true })
  total_amount: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  amount_paid: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  balance_due: number;

  @Column({ type: 'varchar', enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED'], default: 'PENDING' })
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';

  @Column({ type: 'varchar', enum: PAYMENT_METHODS, default: 'ONLINE' })
  payment_method: PaymentMethod;

  @Column({ type: 'timestamp', nullable: true })
  confirmed_at: Date | null;

  @Column({ type: 'uuid', nullable: true })
  confirmed_by_user_id: string | null;

  @Column({ type: 'text', nullable: true })
  confirmation_note: string | null;

  @Column({ type: 'varchar', nullable: true })
  external_reference: string | null;

  @Column({ type: 'timestamp', nullable: true })
  paid_at: Date | null;

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
