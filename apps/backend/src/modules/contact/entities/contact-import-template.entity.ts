import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { ContactImportJobApplication } from './contact-import-job-application.entity';

/**
 * Field configuration in the template.
 * Defines visibility, requirement, and display label for each field.
 */
export interface FieldConfig {
  visible: boolean; // Whether this field appears in import UI
  required: boolean; // Whether this field must have a value
  label: string; // Display label (e.g., "First Name", "Student ID")
}

/**
 * Custom field definition.
 * Allows organizations to define additional fields beyond standard contact fields.
 */
export interface CustomFieldDefinition {
  id: string; // UUID for this custom field
  name: string; // Internal name (e.g., "academic_year")
  label: string; // Display label (e.g., "Academic Year")
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'date';
  required: boolean; // Whether this field is mandatory
  description?: string; // Help text
  options?: string[]; // For select fields: available options
}

@Entity('contact_import_templates')
@Index(['organization_id', 'is_default'])
@Index(['organization_id', 'name'], { unique: true })
export class ContactImportTemplate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organization_id: string;

  @Column('varchar')
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  /**
   * If true, this template is used by default for new imports in this org.
   * Only one template per org should have is_default = true.
   */
  @Column('boolean', { default: false })
  is_default: boolean;

  /**
   * Configuration for standard contact fields.
   * Example:
   * {
   *   "first_name": { "visible": true, "required": true, "label": "First Name" },
   *   "email": { "visible": true, "required": true, "label": "Email Address" },
   *   "student_id": { "visible": false, "required": false, "label": "Student ID" },
   *   ...
   * }
   */
  @Column('jsonb', { default: () => "'{}'" })
  fields_config: Record<string, FieldConfig>;

  /**
   * Array of custom fields defined by this organization.
   * Example:
   * [
   *   { id: "uuid1", name: "academic_year", label: "Academic Year", type: "text", required: true },
   *   { id: "uuid2", name: "class", label: "Class", type: "select", required: true, options: ["A", "B", "C"] }
   * ]
   */
  @Column('jsonb', { default: () => "'[]'" })
  custom_fields: CustomFieldDefinition[];

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @OneToMany(() => ContactImportJobApplication, app => app.template)
  import_job_applications: ContactImportJobApplication[];
}
