import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type ComplianceExportJobStatus = 'QUEUED' | 'PROCESSING' | 'READY' | 'FAILED';

@Entity('compliance_export_jobs')
@Index('IDX_compliance_export_jobs_org_created', ['organization_id', 'created_at'])
@Index('IDX_compliance_export_jobs_org_status', ['organization_id', 'status'])
export class ComplianceExportJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  requested_by_user_id: string;

  @Column({ type: 'varchar', enum: ['QUEUED', 'PROCESSING', 'READY', 'FAILED'], default: 'QUEUED' })
  status: ComplianceExportJobStatus;

  @Column({ type: 'jsonb', nullable: true })
  scope: Record<string, unknown> | null;

  @Column({ type: 'text', nullable: true })
  request_reason: string | null;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @Column({ type: 'varchar', nullable: true })
  download_url: string | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
