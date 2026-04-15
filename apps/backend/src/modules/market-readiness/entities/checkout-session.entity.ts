import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

export type CheckoutSessionStatus = 'STARTED' | 'FAILED' | 'COMPLETED' | 'ABANDONED';

@Entity('checkout_sessions')
@Index('IDX_checkout_sessions_org_started', ['organization_id', 'started_at'])
@Index('IDX_checkout_sessions_org_status', ['organization_id', 'status'])
export class CheckoutSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid', nullable: true })
  form_id: string | null;

  @Column({ type: 'uuid', nullable: true })
  contact_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({
    type: 'varchar',
    enum: ['STARTED', 'FAILED', 'COMPLETED', 'ABANDONED'],
    default: 'STARTED',
  })
  status: CheckoutSessionStatus;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  started_at: Date;
}
