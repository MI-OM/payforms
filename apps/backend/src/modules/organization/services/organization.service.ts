import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationKeysDto } from '../dto/organization.dto';
import { StorageService } from '../../../modules/storage/storage.service';

@Injectable()
export class OrganizationService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private storageService: StorageService,
  ) {}

  async create(dto: CreateOrganizationDto) {
    const org = this.organizationRepository.create(dto);
    return this.organizationRepository.save(org);
  }

  async findById(id: string) {
    return this.organizationRepository.findOne({
      where: { id },
      select: [
        'id',
        'name',
        'email',
        'email_verified',
        'logo_url',
        'require_contact_login',
        'notify_submission_confirmation',
        'notify_payment_confirmation',
        'notify_payment_failure',
        'created_at',
      ],
    });
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    const updatePayload: Partial<Organization> = { ...dto };

    if (dto.email) {
      const existing = await this.organizationRepository.findOne({
        where: { id },
        select: ['id', 'email'],
      });

      if (!existing) {
        throw new NotFoundException('Organization not found');
      }

      if (existing.email !== dto.email) {
        updatePayload.email_verified = false;
        updatePayload.email_verification_token = null;
        updatePayload.email_verification_expires_at = null;
      }
    }

    await this.organizationRepository.update(id, updatePayload);
    return this.findById(id);
  }

  async updatePaystackKeys(id: string, dto: UpdateOrganizationKeysDto) {
    await this.organizationRepository.update(id, dto);
    return this.findById(id);
  }

  async uploadLogo(id: string, logoUrl: string) {
    if (!logoUrl) {
      throw new BadRequestException('Logo URL is required');
    }

    if (logoUrl.startsWith('supabase://')) {
      const path = logoUrl.replace('supabase://', '');
      const publicUrl = this.storageService.getPublicUrl(path);
      await this.organizationRepository.update(id, { logo_url: publicUrl });
      return this.findById(id);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const response = await fetch(logoUrl, { method: 'HEAD', signal: controller.signal });
      clearTimeout(timeout);

      const contentLength = response.headers.get('content-length');
      if (contentLength) {
        const fileSizeInBytes = parseInt(contentLength, 10);
        const fileSizeInMB = fileSizeInBytes / (1024 * 1024);
        if (fileSizeInMB > 2) {
          throw new BadRequestException(`Logo file size exceeds 2 MB limit. Received: ${fileSizeInMB.toFixed(2)} MB`);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('2 MB')) {
        throw error;
      }
    }

    await this.organizationRepository.update(id, { logo_url: logoUrl });
    return this.findById(id);
  }

  async uploadLogoFromSupabase(id: string, filePath: string, base64Data: string, contentType: string = 'image/png') {
    const buffer = Buffer.from(base64Data, 'base64');
    const publicUrl = await this.storageService.uploadFile(filePath, buffer, contentType);
    await this.organizationRepository.update(id, { logo_url: publicUrl });
    return this.findById(id);
  }

  async getSettings(id: string) {
    const org = await this.findById(id);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    return {
      id: org.id,
      name: org.name,
      email: org.email,
      email_verified: org.email_verified,
      logo_url: org.logo_url,
      require_contact_login: org.require_contact_login,
      notify_submission_confirmation: org.notify_submission_confirmation,
      notify_payment_confirmation: org.notify_payment_confirmation,
      notify_payment_failure: org.notify_payment_failure,
    };
  }
}
