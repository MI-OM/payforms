import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import { validatePasswordStrength } from '../../common/security/password-policy';
import { TenantResolverService } from '../tenant/tenant-resolver.service';
import {
  ContactLoginDto,
  ContactSetPasswordDto,
  ContactPasswordResetRequestDto,
  ContactResetPasswordDto,
} from './dto/contact-auth.dto';

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

type OrganizationContextInput = {
  organization_id?: string;
  organization_subdomain?: string;
  organization_domain?: string;
  request_host?: string | null;
};

@Injectable()
export class ContactAuthService {
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationService: NotificationService,
    private tenantResolverService: TenantResolverService,
  ) {}

  async login(dto: ContactLoginDto, requestHost?: string | null) {
    const organizationId = await this.resolveOrganizationId({
      organization_id: dto.organization_id,
      organization_subdomain: dto.organization_subdomain,
      organization_domain: dto.organization_domain,
      request_host: requestHost,
    });

    const contact = await this.contactRepository.findOne({
      where: {
        email: this.normalizeEmail(dto.email),
        organization_id: organizationId,
      },
      relations: ['organization'],
    });

    if (!contact || !contact.is_active || !contact.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, contact.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const org = contact.organization;
    if (!org) {
      throw new UnauthorizedException('Invalid contact organization');
    }

    const accessToken = this.jwtService.sign({
      sub: contact.id,
      email: contact.email,
      organization_id: contact.organization_id,
      role: 'CONTACT',
    }, {
      expiresIn: this.configService.get('CONTACT_ACCESS_TOKEN_TTL', '8h'),
    });

    return {
      access_token: accessToken,
      contact: {
        id: contact.id,
        email: contact.email,
        first_name: contact.first_name,
        last_name: contact.last_name,
        phone: contact.phone,
        student_id: contact.student_id,
        organization_id: contact.organization_id,
        is_active: contact.is_active,
        must_reset_password: contact.must_reset_password,
        role: 'CONTACT',
      },
    };
  }

  async validateContact(id: string, organizationId: string): Promise<Contact | null> {
    return this.contactRepository.findOne({ where: { id, organization_id: organizationId } });
  }

  async getOrganizationBranding(organizationId: string) {
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'name', 'logo_url', 'subdomain', 'custom_domain'],
    });

    if (!organization) {
      return null;
    }

    return {
      id: organization.id,
      name: organization.name,
      logo_url: organization.logo_url || null,
      subdomain: organization.subdomain || null,
      custom_domain: organization.custom_domain || null,
    };
  }

  async setPassword(dto: ContactSetPasswordDto) {
    return this.confirmPasswordReset(dto as ContactResetPasswordDto);
  }

  async requestPasswordReset(dto: ContactPasswordResetRequestDto, requestHost?: string | null) {
    const organizationId = await this.resolveOrganizationId({
      organization_id: dto.organization_id,
      organization_subdomain: dto.organization_subdomain,
      organization_domain: dto.organization_domain,
      request_host: requestHost,
    });

    const contact = await this.contactRepository.findOne({
      where: {
        email: this.normalizeEmail(dto.email),
        organization_id: organizationId,
      },
      relations: ['organization'],
    });
    if (!contact) {
      return {
        success: true,
        message: 'If the contact account exists, a password reset link has been sent.',
      };
    }

    const token = this.generateOpaqueToken();
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    contact.password_reset_token = this.hashOpaqueToken(token);
    contact.password_reset_expires_at = expiresAt;
    contact.must_reset_password = true;
    await this.contactRepository.save(contact);

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetLink = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/contact-reset?token=${token}`
      : '';

    if (!resetLink) {
      throw new BadRequestException('FRONTEND_URL is required to send contact password reset emails');
    }

    const organization = contact.organization ||
      (await this.organizationRepository.findOne({ where: { id: contact.organization_id } }));

    if (!contact.email) {
      throw new BadRequestException('Contact email is required to send password reset');
    }

    await this.notificationService.sendPasswordResetEmail(organization, contact.email, resetLink, {
      heading: 'Contact Password Reset',
      intro: 'We received a request to reset your contact account password.',
      expiresInText: '1 hour',
    });

    return {
      success: true,
      message: 'If the contact account exists, a password reset link has been sent.',
    };
  }

  async confirmPasswordReset(dto: ContactResetPasswordDto) {
    validatePasswordStrength(dto.password);
    const hashedToken = this.hashOpaqueToken(dto.token);
    const contact = await this.contactRepository.findOne({
      where: { password_reset_token: In([hashedToken, dto.token]) },
    });
    if (!contact || !contact.password_reset_expires_at) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (contact.password_reset_expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    contact.password_hash = await bcrypt.hash(dto.password, 10);
    contact.is_active = true;
    contact.must_reset_password = false;
    contact.password_reset_token = null;
    contact.password_reset_expires_at = null;
    return this.contactRepository.save(contact);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateOpaqueToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashOpaqueToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private normalizeOptionalValue(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private normalizeSubdomain(value?: string | null) {
    const normalized = this.normalizeOptionalValue(value)?.toLowerCase() ?? null;
    if (!normalized) {
      return null;
    }

    if (!SUBDOMAIN_PATTERN.test(normalized)) {
      throw new BadRequestException('Invalid organization_subdomain format');
    }

    return normalized;
  }

  private normalizeDomain(value?: string | null) {
    const normalized = this.normalizeOptionalValue(value)?.toLowerCase() ?? null;
    if (!normalized) {
      return null;
    }

    const withoutProtocol = normalized.replace(/^https?:\/\//, '');
    const withoutPath = withoutProtocol.split('/')[0];
    const withoutPort = withoutPath.replace(/:\d+$/, '');
    return withoutPort.replace(/\.$/, '');
  }

  private extractHost(value?: string | null) {
    const normalized = this.normalizeOptionalValue(value)?.toLowerCase() ?? null;
    if (!normalized) {
      return null;
    }

    const firstValue = normalized.split(',')[0].trim();
    return this.normalizeDomain(firstValue);
  }

  private extractSubdomainFromHost(host: string) {
    const configuredBaseDomain = this.normalizeDomain(
      this.configService.get<string>('TENANT_BASE_DOMAIN'),
    );
    if (!configuredBaseDomain) {
      return null;
    }

    const suffix = `.${configuredBaseDomain}`;
    if (!host.endsWith(suffix)) {
      return null;
    }

    const candidate = host.slice(0, -suffix.length);
    if (!candidate || candidate.includes('.')) {
      return null;
    }

    if (this.isReservedPlatformSubdomain(candidate)) {
      return null;
    }

    return this.normalizeSubdomain(candidate);
  }

  private isReservedPlatformSubdomain(subdomain: string) {
    const reserved = (this.configService.get<string>('RESERVED_PLATFORM_SUBDOMAINS') || 'api,www')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);

    return reserved.includes(subdomain.toLowerCase());
  }

  private async resolveOrganizationId(input: OrganizationContextInput) {
    const requestHost = this.extractHost(input.request_host);
    const resolvedHostOrganization = requestHost
      ? await this.tenantResolverService.resolveOrganizationFromHost(requestHost)
      : null;

    if (requestHost && this.extractSubdomainFromHost(requestHost) && !resolvedHostOrganization) {
      throw new BadRequestException('Unknown organization subdomain');
    }

    const explicitOrganizationId = this.normalizeOptionalValue(input.organization_id);
    let resolvedExplicitOrganizationId: string | null = explicitOrganizationId;

    const explicitSubdomain = this.normalizeSubdomain(input.organization_subdomain);
    if (explicitSubdomain) {
      const org = await this.organizationRepository.findOne({
        where: { subdomain: explicitSubdomain },
        select: ['id'],
      });
      if (!org) {
        throw new BadRequestException('Invalid organization context');
      }
      resolvedExplicitOrganizationId = org.id;
    }

    const explicitDomain = this.normalizeDomain(input.organization_domain);
    if (explicitDomain) {
      const org = await this.organizationRepository.findOne({
        where: { custom_domain: explicitDomain },
        select: ['id'],
      });
      if (!org) {
        throw new BadRequestException('Invalid organization context');
      }
      resolvedExplicitOrganizationId = org.id;
    }

    if (
      resolvedHostOrganization &&
      resolvedExplicitOrganizationId &&
      resolvedHostOrganization.organization_id !== resolvedExplicitOrganizationId
    ) {
      throw new BadRequestException('Organization context mismatch with request host');
    }

    if (resolvedHostOrganization) {
      return resolvedHostOrganization.organization_id;
    }

    if (resolvedExplicitOrganizationId) {
      return resolvedExplicitOrganizationId;
    }

    throw new BadRequestException(
      'Organization context is required. Provide organization_id, organization_subdomain, or organization_domain.',
    );
  }
}
