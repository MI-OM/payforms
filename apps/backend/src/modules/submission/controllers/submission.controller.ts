import { Controller, Get, Query, Request, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubmissionExportQueryDto } from '../dto/submission.dto';
import { SubmissionService } from '../services/submission.service';

@ApiTags('Submissions')
@Controller('submissions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubmissionController {
  constructor(private submissionService: SubmissionService) {}

  @Get('export')
  async exportSubmissions(
    @Request() req,
    @Query() query: SubmissionExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const format = query.format ?? 'csv';
    const output = await this.submissionService.exportSubmissions(
      req.user.organization_id,
      {
        form_id: query.form_id,
        contact_id: query.contact_id,
        start_date: query.start_date,
        end_date: query.end_date,
      },
      format,
    );

    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="submissions.pdf"');
      return output;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="submissions.csv"');
    return output;
  }
}