import { BadRequestException, Body, Controller, Get, Param, Post, Request, UseGuards } from '@nestjs/common';
import { ComplianceService } from './compliance.service';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('compliance')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('ADMIN')
export class ComplianceController {
  constructor(private complianceService: ComplianceService) {}

  @Post('export')
  async requestDataExport(
    @Request() req,
    @Body() body?: { contactId?: string },
  ) {
    if (!body?.contactId) {
      throw new BadRequestException('contactId is required');
    }

    const request = await this.complianceService.requestDataExport(
      req.user.organization_id,
      body.contactId,
      req.user.id,
    );
    return { request };
  }

  @Post('delete')
  async requestDataDeletion(
    @Request() req,
    @Body() body?: { contactId?: string },
  ) {
    if (!body?.contactId) {
      throw new BadRequestException('contactId is required');
    }

    const request = await this.complianceService.requestDataDeletion(
      req.user.organization_id,
      body.contactId,
      req.user.id,
    );
    return { request };
  }

  @Get('export/:contactId/:organizationId')
  async exportData(
    @Request() req,
    @Param('contactId') contactId: string,
    @Param('organizationId') _organizationId: string,
  ) {
    const csv = await this.complianceService.exportContactData(contactId, req.user.organization_id);
    return { data: csv };
  }

  @Get('retention-policy/:organizationId')
  async getRetentionPolicy(@Request() req, @Param('organizationId') _organizationId: string) {
    const policy = await this.complianceService.getDataRetentionPolicy(req.user.organization_id);
    return { policy };
  }

  @Post('retention-policy/:organizationId')
  async updateRetentionPolicy(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Body() body: any,
  ) {
    const policy = await this.complianceService.updateDataRetentionPolicy(
      req.user.organization_id,
      body,
    );
    return { policy };
  }

  @Post('purge/:organizationId')
  async applyRetentionPolicies(@Request() req, @Param('organizationId') _organizationId: string) {
    const result = await this.complianceService.applyDataRetentionPolicies(req.user.organization_id);
    return { result };
  }

  @Get('audit-trail/:organizationId')
  async getAuditTrail(
    @Request() req,
    @Param('organizationId') _organizationId: string,
  ) {
    const trail = await this.complianceService.getComplianceAuditTrail(req.user.organization_id, 90);
    return { trail };
  }
}
