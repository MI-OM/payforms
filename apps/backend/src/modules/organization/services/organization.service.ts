import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../entities/organization.entity';
import { CreateOrganizationDto, UpdateOrganizationDto, UpdateOrganizationKeysDto } from '../dto/organization.dto';
import { StorageService } from '../../../modules/storage/storage.service';

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const DOMAIN_PATTERN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

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
        'subdomain',
        'custom_domain',
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

    const existing = await this.organizationRepository.findOne({
      where: { id },
      select: ['id', 'email'],
    });

    if (!existing) {
      throw new NotFoundException('Organization not found');
    }

    if (dto.email) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      updatePayload.email = normalizedEmail;

      if (existing.email !== normalizedEmail) {
        updatePayload.email_verified = false;
        updatePayload.email_verification_token = null;
        updatePayload.email_verification_expires_at = null;
      }
    }

    if (dto.subdomain !== undefined) {
      updatePayload.subdomain = this.normalizeSubdomain(dto.subdomain);
    }
    if (dto.custom_domain !== undefined) {
      updatePayload.custom_domain = this.normalizeCustomDomain(dto.custom_domain);
    }

    await this.ensureTenantIdentifiersAreUnique(
      id,
      updatePayload.subdomain,
      updatePayload.custom_domain,
    );

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
      subdomain: org.subdomain,
      custom_domain: org.custom_domain,
      require_contact_login: org.require_contact_login,
      notify_submission_confirmation: org.notify_submission_confirmation,
      notify_payment_confirmation: org.notify_payment_confirmation,
      notify_payment_failure: org.notify_payment_failure,
    };
  }

  private normalizeSubdomain(value: string | null) {
    if (value === null) {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (!SUBDOMAIN_PATTERN.test(normalized)) {
      throw new BadRequestException(
        'Invalid subdomain format. Use lowercase letters, numbers, and hyphens only.',
      );
    }

    return normalized;
  }

  private normalizeCustomDomain(value: string | null) {
    if (value === null) {
      return null;
    }

    const withoutProtocol = value.trim().toLowerCase().replace(/^https?:\/\//, '');
    const withoutPath = withoutProtocol.split('/')[0].trim();
    const withoutPort = withoutPath.replace(/:\d+$/, '');
    const normalized = withoutPort.replace(/\.$/, '');

    if (!normalized) {
      return null;
    }

    if (!DOMAIN_PATTERN.test(normalized)) {
      throw new BadRequestException('Invalid custom domain format');
    }

    return normalized;
  }

  private async ensureTenantIdentifiersAreUnique(
    organizationId: string,
    subdomain?: string | null,
    customDomain?: string | null,
  ) {
    if (subdomain !== undefined && subdomain !== null) {
      const existingSubdomain = await this.organizationRepository.findOne({
        where: { subdomain },
        select: ['id'],
      });
      if (existingSubdomain && existingSubdomain.id !== organizationId) {
        throw new BadRequestException('Subdomain is already in use');
      }
    }

    if (customDomain !== undefined && customDomain !== null) {
      const existingCustomDomain = await this.organizationRepository.findOne({
        where: { custom_domain: customDomain },
        select: ['id'],
      });
      if (existingCustomDomain && existingCustomDomain.id !== organizationId) {
        throw new BadRequestException('Custom domain is already in use');
      }
    }
  }
}
