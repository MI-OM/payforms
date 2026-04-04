import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

@Injectable()
export class TenantResolverService {
  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(ActivityLog)
    private auditLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Resolve organization from request host and fallback context
   * Resolution order:
   * 1. custom domain (organization_domain)
   * 2. subdomain + TENANT_BASE_DOMAIN
   * 3. explicit organization_id fallback
   */
  async resolveOrganizationFromHost(
    host: string,
    fallbackOrgId?: string,
  ): Promise<{ organization_id: string; organization: Organization } | null> {
    if (!host) {
      return null;
    }

    const normalizedHost = host.toLowerCase().split(':')[0]; // remove port

    // 1. Check custom domain
    let org = await this.organizationRepository.findOne({
      where: { custom_domain: normalizedHost },
    });

    if (org) {
      return { organization_id: org.id, organization: org };
    }

    // 2. Check subdomain
    const baseDomain = process.env.TENANT_BASE_DOMAIN || 'localhost';
    if (normalizedHost.endsWith(`.${baseDomain}`) || normalizedHost === baseDomain) {
      const subdomain = normalizedHost === baseDomain ? undefined : normalizedHost.split('.')[0];

      if (subdomain) {
        org = await this.organizationRepository.findOne({
          where: { subdomain },
        });

        if (org) {
          return { organization_id: org.id, organization: org };
        }
      }
    }

    // 3. Fallback to explicit organization_id
    if (fallbackOrgId) {
      org = await this.organizationRepository.findOne({
        where: { id: fallbackOrgId },
      });

      if (org) {
        return { organization_id: org.id, organization: org };
      }
    }

    return null;
  }

  /**
   * Verify that resolved tenant matches expected tenant
   * Used for strict tenant isolation in auth/reset flows
   */
  async verifyTenantMatch(
    resolvedOrgId: string,
    expectedOrgId: string,
    context: string,
    userId?: string,
  ): Promise<boolean> {
    const match = resolvedOrgId === expectedOrgId;

    if (!match) {
      // Log tenant mismatch for audit/security
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          organization_id: resolvedOrgId,
          user_id: userId,
          action: 'TENANT_MISMATCH_REJECTED',
          entity_type: 'auth',
          entity_id: context,
          metadata: {
            resolved_org_id: resolvedOrgId,
            expected_org_id: expectedOrgId,
            context,
          },
        }),
      );

      throw new BadRequestException('Tenant mismatch: unauthorized access attempt');
    }

    return true;
  }

  /**
   * Log tenant resolution event for audit trail
   */
  async logTenantResolution(
    organizationId: string,
    host: string,
    method: 'domain' | 'subdomain' | 'fallback',
    userId?: string,
  ): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        user_id: userId,
        action: 'TENANT_RESOLVED',
        entity_type: 'tenant',
        entity_id: host,
        metadata: { method },
      }),
    );
  }
}
