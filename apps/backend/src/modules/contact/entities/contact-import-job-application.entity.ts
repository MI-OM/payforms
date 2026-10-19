import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContactImportTemplate } from './contact-import-template.entity';

/**
 * Audit trail entity that tracks which template was used for each import job.
 *
 * Purpose:
 * - Records the template ID and a snapshot of the template configuration
 *   at the time the import was executed.
 * - Allows org admins to understand how contacts were imported:
 *   "What fields were expected?" "Were custom fields included?"
 * - Enables compliance audits by preserving the exact template state.
 *
 * Lifecycle:
 * - Created when an import job is validated/committed with a specific template.
 * - Never updated (immutable audit record).
 * - Deleted only when the import job is purged (data retention cleanup).
 */
@Entity('contact_import_job_applications')
@Index(['import_job_id'])
@Index(['template_id'])
export class ContactImportJobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the import job (contact_imports.id).
   * Cascade delete: if the import job is deleted, this record is too.
   */
  @Column('uuid')
  import_job_id: string;

  /**
   * Reference to the template used for this import.
   * Nullable: allows backward compatibility if template is deleted or
   * if import was done before templates existed.
   */
  @Column('uuid', { nullable: true })
  template_id: string | null;

  /**
   * Immutable snapshot of the template configuration at import time.
   * Includes:
   * - fields_config: which fields were visible/required
   * - custom_fields: which custom fields existed
   * - template metadata: name, description
   *
   * Allows audit trail even if template is later modified or deleted.
   */
  @Column('jsonb', { default: () => "'{}'" })
  template_snapshot: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => ContactImportTemplate, template => template.import_job_applications, {
    onDelete: 'SET NULL',
    nullable: true,
  })
  @JoinColumn({ name: 'template_id' })
  template: ContactImportTemplate | null;
}
