import { apiClient } from './api';

export interface FieldConfig {
  visible: boolean;
  required: boolean;
  label: string;
}

export interface CustomFieldDefinition {
  id: string;
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'number' | 'select' | 'date';
  required: boolean;
  description?: string;
  options?: string[];
}

export interface ImportTemplate {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  fields_config: Record<string, FieldConfig>;
  custom_fields: CustomFieldDefinition[];
  created_at: string;
  updated_at: string;
}

export interface ImportTemplateField {
  name: string;
  type: string;
  required: boolean;
  label: string;
  options?: string[];
  customFieldId?: string;
}

export interface CreateImportTemplateDto {
  name: string;
  description?: string;
  fields_config?: Record<string, Partial<FieldConfig>>;
  custom_fields?: CustomFieldDefinition[];
  is_default?: boolean;
}

export type UpdateImportTemplateDto = Partial<CreateImportTemplateDto>;

/**
 * The standard contact fields a template can configure.
 * Mirrors the backend's STANDARD_CONTACT_FIELDS.
 */
export const STANDARD_CONTACT_FIELDS: Record<string, { label: string; defaultRequired: boolean }> = {
  first_name: { label: 'First Name', defaultRequired: true },
  middle_name: { label: 'Middle Name', defaultRequired: false },
  last_name: { label: 'Last Name', defaultRequired: true },
  email: { label: 'Email Address', defaultRequired: true },
  phone: { label: 'Phone Number', defaultRequired: false },
  gender: { label: 'Gender', defaultRequired: false },
  student_id: { label: 'Student ID', defaultRequired: false },
  external_id: { label: 'External ID', defaultRequired: false },
  guardian_name: { label: 'Guardian Name', defaultRequired: false },
  guardian_email: { label: 'Guardian Email', defaultRequired: false },
  guardian_phone: { label: 'Guardian Phone', defaultRequired: false },
};

export const CUSTOM_FIELD_TYPES = ['text', 'email', 'phone', 'number', 'select', 'date'] as const;

class ImportTemplateService {
  /**
   * List every import template configured for the organization.
   */
  async listTemplates(): Promise<ImportTemplate[]> {
    return apiClient.get('/contacts/import-templates');
  }

  /**
   * Get the organization's default template (or the built-in system default).
   */
  async getDefaultTemplate(): Promise<ImportTemplate> {
    return apiClient.get('/contacts/import-templates/default');
  }

  /**
   * Get a single template.
   */
  async getTemplate(templateId: string): Promise<ImportTemplate> {
    return apiClient.get(`/contacts/import-templates/${templateId}`);
  }

  /**
   * Create a template.
   */
  async createTemplate(dto: CreateImportTemplateDto): Promise<ImportTemplate> {
    return apiClient.post('/contacts/import-templates', dto);
  }

  /**
   * Update a template.
   */
  async updateTemplate(
    templateId: string,
    dto: UpdateImportTemplateDto,
  ): Promise<ImportTemplate> {
    return apiClient.patch(`/contacts/import-templates/${templateId}`, dto);
  }

  /**
   * Delete a template. The default template and the last remaining template
   * cannot be deleted.
   */
  async deleteTemplate(templateId: string): Promise<void> {
    return apiClient.delete(`/contacts/import-templates/${templateId}`);
  }

  /**
   * The fields a template exposes for the import screen.
   */
  async getTemplateFields(templateId: string): Promise<{ fields: ImportTemplateField[] }> {
    return apiClient.get(`/contacts/import-templates/${templateId}/fields`);
  }
}

export const importTemplateService = new ImportTemplateService();
