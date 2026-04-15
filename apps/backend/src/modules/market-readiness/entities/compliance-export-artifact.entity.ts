import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('compliance_export_artifacts')
@Index('IDX_compliance_export_artifacts_job_created', ['job_id', 'created_at'])
@Index('IDX_compliance_export_artifacts_org_type', ['organization_id', 'artifact_type'])
export class ComplianceExportArtifact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  job_id: string;

  @Column({ type: 'varchar' })
  artifact_type: string;

  @Column({ type: 'varchar' })
  file_path: string;

  @Column({ type: 'varchar', nullable: true })
  checksum: string | null;

  @Column({ type: 'bigint', nullable: true })
  size_bytes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;
}
