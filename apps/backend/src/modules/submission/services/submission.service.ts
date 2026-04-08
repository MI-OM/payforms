import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';
import { CreateSubmissionDto } from '../dto/submission.dto';
import { Contact } from '../../contact/entities/contact.entity';

type SubmissionFilters = {
  form_id?: string;
  contact_id?: string;
  start_date?: string;
  end_date?: string;
};

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async create(organizationId: string, formId: string, dto: CreateSubmissionDto) {
    const submission = this.submissionRepository.create({
      organization_id: organizationId,
      form_id: formId,
      contact_id: dto.contact_id,
      data: dto.data,
    });
    return this.submissionRepository.save(submission);
  }

  async findByOrganization(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.submissionRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, page, limit };
  }

  async findById(organizationId: string, id: string) {
    return this.submissionRepository.findOne({
      where: { id, organization_id: organizationId },
    });
  }

  async findByForm(organizationId: string, formId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.submissionRepository.findAndCount({
      where: { organization_id: organizationId, form_id: formId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, page, limit };
  }

  async findByContact(organizationId: string, contactId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.submissionRepository.findAndCount({
      where: { organization_id: organizationId, contact_id: contactId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });
    return { data, total, page, limit };
  }

  async exportSubmissions(organizationId: string, filters: SubmissionFilters, format: 'csv' | 'pdf') {
    const submissions = await this.buildSubmissionQuery(organizationId, filters)
      .orderBy('submission.created_at', 'DESC')
      .getMany();

    if (format === 'pdf') {
      return this.buildSubmissionsPdf(submissions);
    }

    return this.buildSubmissionsCsv(submissions);
  }

  private buildSubmissionQuery(organizationId: string, filters: SubmissionFilters) {
    const qb = this.submissionRepository.createQueryBuilder('submission')
      .leftJoinAndSelect('submission.contact', 'contact')
      .where('submission.organization_id = :organizationId', { organizationId });

    if (filters.form_id) {
      qb.andWhere('submission.form_id = :form_id', { form_id: filters.form_id });
    }

    if (filters.contact_id) {
      qb.andWhere('submission.contact_id = :contact_id', { contact_id: filters.contact_id });
    }

    if (filters.start_date) {
      qb.andWhere('submission.created_at >= :start_date', {
        start_date: this.normalizeDateBoundary(filters.start_date, 'start'),
      });
    }

    if (filters.end_date) {
      qb.andWhere('submission.created_at <= :end_date', {
        end_date: this.normalizeDateBoundary(filters.end_date, 'end'),
      });
    }

    return qb;
  }

  private normalizeDateBoundary(value: string, boundary: 'start' | 'end') {
    const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
    const normalizedValue = isDateOnly
      ? `${value}${boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z'}`
      : value;

    const parsed = new Date(normalizedValue);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException(`Invalid ${boundary === 'start' ? 'start_date' : 'end_date'}`);
    }

    return parsed;
  }

  private buildSubmissionsCsv(submissions: Submission[]) {
    const fieldKeys = Array.from(
      submissions.reduce((keys, submission) => {
        Object.keys(submission.data || {}).forEach(key => keys.add(key));
        return keys;
      }, new Set<string>()),
    ).sort();

    const header = [
      'id',
      'form_id',
      'contact_id',
      'contact_email',
      'created_at',
      ...fieldKeys,
      'data_json',
    ];

    const rows = submissions.map(submission => {
      const values = [
        submission.id,
        submission.form_id,
        submission.contact_id || '',
        submission.contact?.email || '',
        submission.created_at?.toISOString() || '',
        ...fieldKeys.map(key => this.stringifyExportValue(submission.data?.[key])),
        JSON.stringify(submission.data || {}),
      ];

      return values.map(value => this.escapeCsv(value)).join(',');
    });

    return `${header.map(value => this.escapeCsv(value)).join(',')}\n${rows.join('\n')}`;
  }

  private async buildSubmissionsPdf(submissions: Submission[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const PDFDocument = require('pdfkit');
      const pdf = new PDFDocument({ margin: 24, size: 'A4' });
      const chunks: Buffer[] = [];

      pdf.on('data', chunk => chunks.push(chunk));
      pdf.on('end', () => resolve(Buffer.concat(chunks)));
      pdf.on('error', reject);

      pdf.fontSize(18).text('Form Submissions Export', { underline: true });
      pdf.moveDown();

      if (!submissions.length) {
        pdf.fontSize(12).text('No submissions found for the selected filters.');
        pdf.end();
        return;
      }

      submissions.forEach((submission, index) => {
        if (index > 0) {
          pdf.moveDown();
          pdf.strokeColor('#e2e8f0').lineWidth(1).moveTo(24, pdf.y).lineTo(571, pdf.y).stroke();
          pdf.moveDown();
        }

        pdf.fontSize(12).fillColor('#1a202c').text(`Submission ${index + 1}`);
        pdf.fontSize(10).fillColor('#4a5568').text(`ID: ${submission.id}`);
        pdf.text(`Form ID: ${submission.form_id}`);
        pdf.text(`Contact ID: ${submission.contact_id || 'N/A'}`);
        pdf.text(`Contact Email: ${submission.contact?.email || 'N/A'}`);
        pdf.text(`Created At: ${submission.created_at?.toISOString() || 'N/A'}`);
        pdf.moveDown(0.5);
        pdf.fillColor('#2d3748').text('Data');
        pdf.fillColor('#4a5568').text(JSON.stringify(submission.data || {}, null, 2));
      });

      pdf.end();
    });
  }

  private stringifyExportValue(value: unknown) {
    if (value === null || value === undefined) {
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  }

  private escapeCsv(value: unknown) {
    const raw = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
}
