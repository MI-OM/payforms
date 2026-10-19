import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ContactImportTemplate, FieldConfig, CustomFieldDefinition } from '../entities/contact-import-template.entity';
import { ContactImportJobApplication } from '../entities/contact-import-job-application.entity';
import { Organization } from '../../organization/entities/organization.entity';

/**
 * Standard contact fields that can be configured in an import template.
 * Each field has a default visibility and requirement setting.
 */
export const STANDARD_CONTACT_FIELDS = {
  first_name: { visible: true, required: true, label: 'First Name' },
  middle_name: { visible: false, required: false, label: 'Middle Name' },
  last_name: { visible: true, required: true, label: 'Last Name' },
  email: { visible: true, required: true, label: 'Email Address' },
  phone: { visible: true, required: false, label: 'Phone Number' },
  gender: { visible: false, required: false, label: 'Gender' },
  student_id: { visible: true, required: false, label: 'Student ID' },
  external_id: { visible: false, required: false, label: 'External ID' },
  guardian_name: { visible: true, required: false, label: 'Guardian Name' },
  guardian_email: { visible: false, required: false, label: 'Guardian Email' },
  guardian_phone: { visible: false, required: false, label: 'Guardian Phone' },
} as const;

export interface CreateImportTemplateDto {
  name: string;
  description?: string;
  fields_config?: Record<string, Partial<FieldConfig>>;
  custom_fields?: CustomFieldDefinition[];
  is_default?: boolean;
}

export interface UpdateImportTemplateDto {
  name?: string;
  description?: string;
  fields_config?: Record<string, Partial<FieldConfig>>;
  custom_fields?: CustomFieldDefinition[];
  is_default?: boolean;
}

@Injectable()
export class ContactImportTemplateService {
  constructor(
    @InjectRepository(ContactImportTemplate)
    private templateRepository: Repository<ContactImportTemplate>,
    @InjectRepository(ContactImportJobApplication)
    private jobApplicationRepository: Repository<ContactImportJobApplication>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
  ) {}

  /**
   * Get the default import template for an organization.
   * If no template is configured, returns a system template with standard fields.
   */
  async getDefaultTemplate(organizationId: string): Promise<ContactImportTemplate> {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    // If organization has a default template configured, use it
    if (org.default_import_template_id) {
      const template = await this.templateRepository.findOne({
        where: { id: org.default_import_template_id, organization_id: organizationId },
      });
      if (template) {
        return template;
      }
    }

    // Otherwise, try to find the first template marked as default
    const defaultTemplate = await this.templateRepository.findOne({
      where: { organization_id: organizationId, is_default: true },
    });

    if (defaultTemplate) {
      return defaultTemplate;
    }

    // If no template exists, create a default system template
    return this.createSystemDefaultTemplate(organizationId);
  }

  /**
   * Create a system default template with all standard fields visible and required as needed.
   * This is returned when no custom templates exist.
   */
  private createSystemDefaultTemplate(organizationId: string): ContactImportTemplate {
    const template = new ContactImportTemplate();
    template.id = 'system-default-' + organizationId;
    template.organization_id = organizationId;
    template.name = 'System Default';
    template.description = 'Built-in template with standard contact fields';
    template.is_default = false; // Not persisted, just returned
    template.fields_config = { ...STANDARD_CONTACT_FIELDS } as Record<string, FieldConfig>;
    template.custom_fields = [];
    template.created_at = new Date();
    template.updated_at = new Date();
    return template;
  }

  /**
   * Create a new import template for an organization.
   */
  async createTemplate(
    organizationId: string,
    dto: CreateImportTemplateDto,
  ): Promise<ContactImportTemplate> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Template name is required');
    }

    // Validate fields_config if provided
    let fieldsConfig: Record<string, FieldConfig> = { ...STANDARD_CONTACT_FIELDS } as Record<string, FieldConfig>;
    if (dto.fields_config) {
      fieldsConfig = this.mergeFieldsConfig(fieldsConfig, dto.fields_config);
    }

    // Validate custom fields
    const customFields = this.validateCustomFields(dto.custom_fields || []);

    // If marking as default, unset default on all other templates
    if (dto.is_default) {
      await this.templateRepository.update(
        { organization_id: organizationId, is_default: true },
        { is_default: false },
      );
    }

    const template = this.templateRepository.create({
      organization_id: organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      fields_config: fieldsConfig,
      custom_fields: customFields,
      is_default: dto.is_default || false,
    });

    const saved = await this.templateRepository.save(template);

    // If this is the default, update the organization's reference
    if (saved.is_default) {
      await this.organizationRepository.update(
        { id: organizationId },
        { default_import_template_id: saved.id },
      );
    }

    return saved;
  }

  /**
   * Update an existing import template.
   */
  async updateTemplate(
    organizationId: string,
    templateId: string,
    dto: UpdateImportTemplateDto,
  ): Promise<ContactImportTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organization_id: organizationId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    // Update fields
    if (dto.name !== undefined) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('Template name cannot be empty');
      }
      template.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      template.description = dto.description?.trim() || null;
    }

    // Merge fields_config
    if (dto.fields_config) {
      template.fields_config = this.mergeFieldsConfig(template.fields_config, dto.fields_config);
    }

    // Update custom fields
    if (dto.custom_fields !== undefined) {
      template.custom_fields = this.validateCustomFields(dto.custom_fields);
    }

    // Handle default flag change
    if (dto.is_default !== undefined) {
      if (dto.is_default && !template.is_default) {
        // Setting this as default: unset default on others
        await this.templateRepository.update(
          { organization_id: organizationId, is_default: true },
          { is_default: false },
        );
        template.is_default = true;

        // Update org reference
        await this.organizationRepository.update(
          { id: organizationId },
          { default_import_template_id: templateId },
        );
      } else if (!dto.is_default && template.is_default) {
        // Unsetting as default
        template.is_default = false;
        await this.organizationRepository.update(
          { id: organizationId },
          { default_import_template_id: null },
        );
      }
    }

    return this.templateRepository.save(template);
  }

  /**
   * Delete an import template.
   * Fails if it's the only template or if it's the default.
   */
  async deleteTemplate(organizationId: string, templateId: string): Promise<void> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organization_id: organizationId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    if (template.is_default) {
      throw new BadRequestException('Cannot delete the default template');
    }

    // Check if there are other templates
    const count = await this.templateRepository.count({
      where: { organization_id: organizationId },
    });

    if (count <= 1) {
      throw new BadRequestException('Cannot delete the last template for an organization');
    }

    await this.templateRepository.delete(templateId);
  }

  /**
   * List all import templates for an organization.
   */
  async listTemplates(organizationId: string): Promise<ContactImportTemplate[]> {
    return this.templateRepository.find({
      where: { organization_id: organizationId },
      order: { is_default: 'DESC', created_at: 'ASC' },
    });
  }

  /**
   * Get a single template by ID.
   */
  async getTemplate(organizationId: string, templateId: string): Promise<ContactImportTemplate> {
    const template = await this.templateRepository.findOne({
      where: { id: templateId, organization_id: organizationId },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  /**
   * Record which template was used for an import job.
   * Creates an immutable snapshot of the template configuration.
   */
  async recordTemplateUsage(
    importJobId: string,
    templateId: string | null,
  ): Promise<ContactImportJobApplication> {
    let template: ContactImportTemplate | null = null;
    let snapshot: Record<string, any> = {};

    if (templateId) {
      template = await this.templateRepository.findOne({ where: { id: templateId } });
      if (template) {
        snapshot = {
          name: template.name,
          description: template.description,
          fields_config: template.fields_config,
          custom_fields: template.custom_fields,
        };
      }
    }

    const application = this.jobApplicationRepository.create({
      import_job_id: importJobId,
      template_id: templateId,
      template_snapshot: snapshot,
    });

    return this.jobApplicationRepository.save(application);
  }

  /**
   * Merge incoming fields_config with existing config.
   * Preserves existing fields that are not overridden.
   */
  private mergeFieldsConfig(
    existing: Record<string, FieldConfig>,
    updates: Record<string, Partial<FieldConfig>>,
  ): Record<string, FieldConfig> {
    const merged = { ...existing };

    for (const [fieldName, update] of Object.entries(updates)) {
      if (!STANDARD_CONTACT_FIELDS[fieldName as keyof typeof STANDARD_CONTACT_FIELDS]) {
        throw new BadRequestException(`Unknown standard field: ${fieldName}`);
      }

      merged[fieldName] = {
        visible: update.visible !== undefined ? update.visible : existing[fieldName]?.visible ?? true,
        required: update.required !== undefined ? update.required : existing[fieldName]?.required ?? false,
        label: update.label !== undefined ? update.label : existing[fieldName]?.label ?? fieldName,
      };
    }

    return merged;
  }

  /**
   * Validate custom field definitions.
   * Ensures all custom fields have required properties and valid types.
   */
  private validateCustomFields(fields: CustomFieldDefinition[]): CustomFieldDefinition[] {
    const validTypes = ['text', 'email', 'phone', 'number', 'select', 'date'];
    const seenIds = new Set<string>();

    for (const field of fields) {
      if (!field.id || !field.name || !field.label) {
        throw new BadRequestException('Custom field must have id, name, and label');
      }

      if (seenIds.has(field.id)) {
        throw new BadRequestException(`Duplicate custom field id: ${field.id}`);
      }
      seenIds.add(field.id);

      if (!validTypes.includes(field.type)) {
        throw new BadRequestException(
          `Invalid custom field type: ${field.type}. Must be one of: ${validTypes.join(', ')}`,
        );
      }

      if (field.type === 'select' && (!field.options || field.options.length === 0)) {
        throw new BadRequestException('Select fields must have at least one option');
      }
    }

    return fields;
  }

  /**
   * Get the field configuration for a template in a format suitable for the import UI.
   * Includes both standard fields (filtered by visibility) and custom fields.
   */
  async getTemplateFieldsForImport(
    organizationId: string,
    templateId: string | null,
  ): Promise<{
    fields: Array<{
      name: string;
      type: string;
      required: boolean;
      label: string;
      options?: string[];
    }>;
    customFields: CustomFieldDefinition[];
  }> {
    let template: ContactImportTemplate;

    if (templateId) {
      template = await this.getTemplate(organizationId, templateId);
    } else {
      template = await this.getDefaultTemplate(organizationId);
    }

    // Build visible fields list
    const fields: Array<{
      name: string;
      type: string;
      required: boolean;
      label: string;
      options?: string[];
    }> = [];
    for (const [fieldName, config] of Object.entries(template.fields_config)) {
      if (config.visible) {
        const type = this.getFieldType(fieldName);
        fields.push({
          name: fieldName,
          type,
          required: config.required,
          label: config.label,
        });
      }
    }

    // Add custom fields
    for (const customField of template.custom_fields) {
      fields.push({
        name: `custom_${customField.id}`,
        type: customField.type,
        required: customField.required,
        label: customField.label,
        options: customField.options,
      });
    }

    return {
      fields,
      customFields: template.custom_fields,
    };
  }

  /**
   * Infer the data type for a standard contact field.
   */
  private getFieldType(fieldName: string): string {
    if (['email', 'guardian_email'].includes(fieldName)) return 'email';
    if (['phone', 'guardian_phone'].includes(fieldName)) return 'phone';
    if (['gender'].includes(fieldName)) return 'select';
    return 'text';
  }
}
