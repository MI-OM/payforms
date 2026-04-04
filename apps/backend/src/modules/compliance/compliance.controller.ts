import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { ComplianceService } from './compliance.service';

@Controller('compliance')
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Post('export')
  async requestDataExport(
    @Body() body: { organizationId: string; contactId: string; requestedBy: string },
  ) {
    const request = await this.complianceService.requestDataExport(
      body.organizationId,
      body.contactId,
      body.requestedBy,
    );
    return { request };
  }

  @Post('delete')
  async requestDataDeletion(
    @Body() body: { organizationId: string; contactId: string; requestedBy: string },
  ) {
    const request = await this.complianceService.requestDataDeletion(
      body.organizationId,
      body.contactId,
      body.requestedBy,
    );
    return { request };
  }

  @Get('export/:contactId/:organizationId')
  async exportData(
    @Param('contactId') contactId: string,
    @Param('organizationId') organizationId: string,
  ) {
    const csv = await this.complianceService.exportContactData(contactId, organizationId);
    return { data: csv };
  }

  @Get('retention-policy/:organizationId')
  async getRetentionPolicy(@Param('organizationId') organizationId: string) {
    const policy = await this.complianceService.getDataRetentionPolicy(organizationId);
    return { policy };
  }

  @Post('retention-policy/:organizationId')
  async updateRetentionPolicy(
    @Param('organizationId') organizationId: string,
    @Body() body: any,
  ) {
    const policy = await this.complianceService.updateDataRetentionPolicy(
      organizationId,
      body,
    );
    return { policy };
  }

  @Post('purge/:organizationId')
  async applyRetentionPolicies(@Param('organizationId') organizationId: string) {
    const result = await this.complianceService.applyDataRetentionPolicies(organizationId);
    return { result };
  }

  @Get('audit-trail/:organizationId')
  async getAuditTrail(
    @Param('organizationId') organizationId: string,
  ) {
    const trail = await this.complianceService.getComplianceAuditTrail(organizationId, 90);
    return { trail };
  }
}
