import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContactImportTemplateService, CreateImportTemplateDto, UpdateImportTemplateDto } from '../services/contact-import-template.service';

@ApiTags('Contact Import Templates')
@Controller('contacts/import-templates')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactImportTemplateController {
  constructor(private readonly templateService: ContactImportTemplateService) {}

  /**
   * Get the default import template for the organization.
   * Returns the template currently configured as default, or the system default if none exists.
   */
  @Get('default')
  @ApiOperation({ summary: 'Get the default import template for the organization' })
  async getDefaultTemplate(@Request() req) {
    return this.templateService.getDefaultTemplate(req.user.organization_id);
  }

  /**
   * List all import templates for the organization.
   */
  @Get()
  @ApiOperation({ summary: 'List all import templates' })
  async listTemplates(@Request() req) {
    return this.templateService.listTemplates(req.user.organization_id);
  }

  /**
   * Get a specific template by ID.
   */
  @Get(':templateId')
  @ApiOperation({ summary: 'Get a specific template by ID' })
  async getTemplate(@Request() req, @Param('templateId') templateId: string) {
    return this.templateService.getTemplate(req.user.organization_id, templateId);
  }

  /**
   * Create a new import template.
   * Allows orgs to define custom field configurations and custom fields for imports.
   */
  @Post()
  @ApiOperation({ summary: 'Create a new import template' })
  async createTemplate(@Request() req, @Body() dto: CreateImportTemplateDto) {
    return this.templateService.createTemplate(req.user.organization_id, dto);
  }

  /**
   * Update an existing template.
   */
  @Patch(':templateId')
  @ApiOperation({ summary: 'Update an import template' })
  async updateTemplate(
    @Request() req,
    @Param('templateId') templateId: string,
    @Body() dto: UpdateImportTemplateDto,
  ) {
    return this.templateService.updateTemplate(req.user.organization_id, templateId, dto);
  }

  /**
   * Delete an import template.
   * Cannot delete the default template or the last template.
   */
  @Delete(':templateId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an import template' })
  async deleteTemplate(@Request() req, @Param('templateId') templateId: string) {
    await this.templateService.deleteTemplate(req.user.organization_id, templateId);
  }

  /**
   * Get the field configuration for a template in a format suitable for the import UI.
   * Returns visible fields and custom fields with their types and requirements.
   */
  @Get(':templateId/fields')
  @ApiOperation({ summary: 'Get fields for import UI from a template' })
  async getTemplateFields(@Request() req, @Param('templateId') templateId: string) {
    return this.templateService.getTemplateFieldsForImport(req.user.organization_id, templateId);
  }
}
