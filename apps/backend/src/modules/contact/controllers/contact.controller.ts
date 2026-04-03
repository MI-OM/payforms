import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, Query, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ContactService } from '../services/contact.service';
import { ContactImportService } from '../services/contact-import.service';
import { ContactImportStatus } from '../entities/contact-import.entity';
import { CreateContactDto, UpdateContactDto, BulkImportContactsDto, ContactImportValidateDto, ContactImportCommitDto, ContactCsvImportDto, ContactQueryDto, ContactTransactionQueryDto, AssignContactGroupsDto } from '../dto/contact.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Contacts')
@Controller('contacts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactController {
  constructor(
    private contactService: ContactService,
    private contactImportService: ContactImportService,
  ) {}

  @Post()
  async createContact(@Request() req, @Body() dto: CreateContactDto) {
    const contact = await this.contactService.create(req.user.organization_id, dto);
    await this.contactImportService.sendPasswordSetupEmails(req.user.organization_id, [contact]);
    return contact;
  }

  @Get()
  async listContacts(@Request() req, @Query() query: ContactQueryDto) {
    return this.contactService.findByOrganization(
      req.user.organization_id,
      query.page ?? 1,
      query.limit ?? 20,
      query.group_id,
    );
  }

  @Get('export')
  async exportContacts(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
    @Query() query: ContactQueryDto,
  ) {
    const csv = await this.contactService.exportContacts(req.user.organization_id, query.group_id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="contacts.csv"');
    return csv;
  }

  @Get(':id')
  async getContact(@Request() req, @Param('id') id: string) {
    return this.contactService.findById(req.user.organization_id, id);
  }

  @Get(':id/details')
  async getContactDetails(@Request() req, @Param('id') id: string) {
    const result = await this.contactService.getContactWithGroups(req.user.organization_id, id);
    if (!result) {
      return null; // 404 should be handled by lens/conf in controller layer if needed
    }
    return result;
  }

  @Patch(':id')
  async updateContact(@Request() req, @Param('id') id: string, @Body() dto: UpdateContactDto) {
    return this.contactService.update(req.user.organization_id, id, dto);
  }

  @Delete(':id')
  async deleteContact(@Request() req, @Param('id') id: string) {
    return this.contactService.delete(req.user.organization_id, id);
  }

  @Post('import')
  async bulkImport(@Request() req, @Body() dto: BulkImportContactsDto) {
    const contacts = await this.contactService.bulkImport(req.user.organization_id, dto.contacts);
    await this.contactImportService.sendPasswordSetupEmails(req.user.organization_id, contacts);
    return contacts;
  }

  @Post('imports/validate')
  async validateImport(@Request() req, @Body() dto: ContactImportValidateDto) {
    return this.contactImportService.validateImport(req.user.organization_id, dto.contacts, req.user.id);
  }

  @Post('imports/csv/validate')
  async validateCsvImport(@Request() req, @Body() dto: ContactCsvImportDto) {
    const contacts = this.contactService.parseCsvImport(dto.csv);
    return this.contactImportService.validateImport(req.user.organization_id, contacts, req.user.id);
  }

  @Post('imports/:id/commit')
  async commitImport(@Request() req, @Param('id') id: string) {
    return this.contactImportService.commitImport(req.user.organization_id, id);
  }

  @Post('imports/csv/commit')
  async commitCsvImport(@Request() req, @Body() dto: ContactCsvImportDto) {
    const contacts = this.contactService.parseCsvImport(dto.csv);
    const validation = await this.contactImportService.validateImport(req.user.organization_id, contacts, req.user.id);
    if (validation.status !== ContactImportStatus.VALIDATED) {
      return validation;
    }
    return this.contactImportService.commitImport(req.user.organization_id, validation.import_id);
  }

  @Get('imports')
  async listImports(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.contactImportService.listImports(req.user.organization_id, page, limit);
  }

  @Get('imports/:id')
  async getImport(@Request() req, @Param('id') id: string) {
    return this.contactImportService.getImport(req.user.organization_id, id);
  }

  @Get(':id/transactions')
  async getTransactionHistory(
    @Request() req,
    @Param('id') id: string,
    @Query() query: ContactTransactionQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (query.format === 'csv' && res) {
      const csv = await this.contactService.exportTransactionHistory(req.user.organization_id, id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="contact_${id}_transactions.csv"`);
      return csv;
    }

    return this.contactService.getTransactionHistory(
      req.user.organization_id,
      id,
      query.page ?? 1,
      query.limit ?? 20,
    );
  }

  @Post(':id/groups')
  async assignToGroups(@Request() req, @Param('id') id: string, @Body() body: AssignContactGroupsDto) {
    return this.contactService.assignToGroups(req.user.organization_id, id, body.group_ids);
  }
}
