import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

export enum ContactImportStatus {
  PENDING = 'PENDING',
  VALIDATED = 'VALIDATED',
  FAILED = 'FAILED',
  COMPLETED = 'COMPLETED',
}

@Entity('contact_imports')
@Index(['organization_id', 'status'])
export class ContactImport {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column({ nullable: true })
  created_by?: string;

  @Column({ type: 'varchar', enum: ContactImportStatus, default: ContactImportStatus.PENDING })
  status: ContactImportStatus;

  @Column({ type: 'int', default: 0 })
  total_count: number;

  @Column({ type: 'int', default: 0 })
  success_count: number;

  @Column({ type: 'int', default: 0 })
  failure_count: number;

  @Column({ type: 'json', nullable: true })
  payload: any;

  @Column({ type: 'json', nullable: true })
  errors: any;

  @Column({ type: 'timestamp', nullable: true })
  completed_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @ManyToOne(() => Organization, org => org.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
