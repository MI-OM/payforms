import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ReconciliationExceptionStatus = 'OPEN' | 'RESOLVED' | 'IGNORED';
export type ReconciliationExceptionSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

@Entity('reconciliation_exceptions')
@Index('IDX_reconciliation_exceptions_run_status', ['run_id', 'status'])
@Index('IDX_reconciliation_exceptions_org_created', ['organization_id', 'created_at'])
export class ReconciliationException {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  run_id: string;

  @Column({ type: 'uuid', nullable: true })
  payment_id: string | null;

  @Column({ type: 'varchar', nullable: true })
  reference: string | null;

  @Column({ type: 'varchar' })
  type: string;

  @Column({ type: 'varchar', enum: ['LOW', 'MEDIUM', 'HIGH'], default: 'MEDIUM' })
  severity: ReconciliationExceptionSeverity;

  @Column({ type: 'varchar', enum: ['OPEN', 'RESOLVED', 'IGNORED'], default: 'OPEN' })
  status: ReconciliationExceptionStatus;

  @Column({ type: 'jsonb', nullable: true })
  details: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
