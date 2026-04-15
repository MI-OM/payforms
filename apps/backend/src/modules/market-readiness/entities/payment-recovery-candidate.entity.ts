import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RecoveryCandidateStatus = 'OPEN' | 'QUEUED' | 'NOTIFIED' | 'RESOLVED' | 'DISMISSED';

@Entity('payment_recovery_candidates')
@Index('IDX_payment_recovery_candidates_org_detected', ['organization_id', 'detected_at'])
@Index('IDX_payment_recovery_candidates_org_status', ['organization_id', 'status'])
@Index('UQ_payment_recovery_candidates_payment', ['payment_id'], { unique: true })
export class PaymentRecoveryCandidate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  payment_id: string;

  @Column({ type: 'varchar' })
  reference: string;

  @Column({
    type: 'varchar',
    enum: ['OPEN', 'QUEUED', 'NOTIFIED', 'RESOLVED', 'DISMISSED'],
    default: 'OPEN',
  })
  status: RecoveryCandidateStatus;

  @Column({ type: 'timestamp', nullable: true })
  last_notified_at: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempt_count: number;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  detected_at: Date;
}
