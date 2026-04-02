import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../entities/submission.entity';
import { CreateSubmissionDto } from '../dto/submission.dto';

@Injectable()
export class SubmissionService {
  constructor(
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
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
}
