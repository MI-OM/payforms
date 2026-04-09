import { Controller, Get, Param, Query, Res, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportService } from '../services/report.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReportController {
  constructor(private reportService: ReportService) {}

  @Get('summary')
  async getSummary(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportService.getSummary(req.user.organization_id, startDate, endDate);
  }

  @Get('analytics')
  async getAnalytics(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportService.getAnalytics(req.user.organization_id, startDate, endDate);
  }

  @Get('forms/performance')
  async getFormPerformance(
    @Request() req,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportService.getFormPerformance(req.user.organization_id, startDate, endDate);
  }

  @Get('forms/:formId/submission-summary')
  async getFormSubmissionSummary(
    @Request() req,
    @Param('formId') formId: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportService.getFormSubmissionSummary(req.user.organization_id, formId, startDate, endDate);
  }

  @Get('groups/contributions')
  async getGroupContributions(
    @Request() req,
    @Query('form_id') formId?: string,
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    return this.reportService.getGroupContributions(req.user.organization_id, formId, startDate, endDate);
  }

  @Get('export')
  async exportReport(
    @Request() req,
    @Res({ passthrough: true }) res: Response,
    @Query('type') type: 'summary' | 'analytics' = 'summary',
    @Query('format') format: 'csv' | 'pdf' = 'csv',
    @Query('start_date') startDate?: string,
    @Query('end_date') endDate?: string,
  ) {
    const output = await this.reportService.exportReport(req.user.organization_id, type, format, startDate, endDate);

    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="report-${type}.csv"`);
      return output;
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="report-${type}.pdf"`);
    return output;
  }
}
