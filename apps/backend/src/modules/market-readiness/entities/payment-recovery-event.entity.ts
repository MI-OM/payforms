import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type RecoveryEventType = 'DETECTED' | 'QUEUED' | 'NOTIFIED' | 'RUN';

@Entity('payment_recovery_events')
@Index('IDX_payment_recovery_events_candidate_created', ['candidate_id', 'created_at'])
export class PaymentRecoveryEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  candidate_id: string | null;

  @Column({
    type: 'varchar',
    enum: ['DETECTED', 'QUEUED', 'NOTIFIED', 'RUN'],
  })
  event_type: RecoveryEventType;

  @Column({ type: 'jsonb', nullable: true })
  payload: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
