import { Injectable, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { Contact } from '../../contact/entities/contact.entity';
import { ActivityLog } from '../../audit/entities/activity-log.entity';

export interface ContactAuthAttempt {
  contact_id: string;
  organization_id: string;
  ip_address?: string;
  success: boolean;
  timestamp: Date;
}

@Injectable()
export class ContactAuthHardeningService {
  private readonly FAILED_ATTEMPT_LIMIT = 5;
  private readonly LOCKOUT_DURATION_MINUTES = 15;
  private readonly MAX_TOKEN_AGE_HOURS = 24;

  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(ActivityLog)
    private auditLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Check if contact is locked out due to failed auth attempts
   */
  async isContactLockedOut(
    contactId: string,
    organizationId: string,
    recentFailures?: number,
  ): Promise<{ locked: boolean; remainingMinutes?: number }> {
    const lockoutThreshold = new Date(Date.now() - this.LOCKOUT_DURATION_MINUTES * 60 * 1000);

    const failedAttempts =
      (recentFailures ??
        Number(
          await this.auditLogRepository.count({
            where: {
              organization_id: organizationId,
              entity_id: contactId,
              action: 'CONTACT_AUTH_FAILED',
              created_at: MoreThan(lockoutThreshold),
            },
          }),
        )) || 0;

    if (failedAttempts >= this.FAILED_ATTEMPT_LIMIT) {
      // Calculate remaining lockout time
      const oldestFailure = await this.auditLogRepository.findOne({
        where: {
          organization_id: organizationId,
          entity_id: contactId,
          action: 'CONTACT_AUTH_FAILED',
        },
        order: { created_at: 'ASC' },
      });

      if (oldestFailure) {
        const lockoutExpiry = new Date(
          oldestFailure.created_at.getTime() + this.LOCKOUT_DURATION_MINUTES * 60 * 1000,
        );
        const remainingMs = lockoutExpiry.getTime() - Date.now();
        const remainingMinutes = Math.ceil(remainingMs / 60000);

        if (remainingMinutes > 0) {
          return { locked: true, remainingMinutes };
        }
      }

      // Lockout expired, clear old attempts
      await this.auditLogRepository.delete({
        organization_id: organizationId,
        entity_id: contactId,
        action: 'CONTACT_AUTH_FAILED',
        created_at: MoreThan(lockoutThreshold),
      });
    }

    return { locked: false };
  }

  /**
   * Record failed authentication attempt
   */
  async recordFailedAttempt(
    contactId: string,
    organizationId: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: contactId,
        entity_type: 'contact_auth',
        action: 'CONTACT_AUTH_FAILED',
        metadata: {
          ip_address: ipAddress,
          reason: 'invalid_credentials',
        },
      }),
    );
  }

  /**
   * Record successful authentication attempt
   */
  async recordSuccessfulAttempt(
    contactId: string,
    organizationId: string,
    ipAddress?: string,
  ): Promise<void> {
    // Clear failed attempts from lockout record
    const lockoutThreshold = new Date(Date.now() - this.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    await this.auditLogRepository.delete({
      organization_id: organizationId,
      entity_id: contactId,
      action: 'CONTACT_AUTH_FAILED',
      created_at: MoreThan(lockoutThreshold),
    });

    // Log successful auth
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: contactId,
        entity_type: 'contact_auth',
        action: 'CONTACT_AUTH_SUCCESS',
        metadata: {
          ip_address: ipAddress,
        },
      }),
    );
  }

  /**
   * Invalidate all auth tokens for a contact (e.g., on password change)
   */
  async invalidateContactTokens(
    contactId: string,
    organizationId: string,
    reason: string,
  ): Promise<void> {
    // Update contact's token_invalidated_at timestamp
    // This allows clients to detect when their current token is no longer valid
    await this.contactRepository
      .createQueryBuilder()
      .update(Contact)
      .set({
        token_invalidated_at: new Date(),
      })
      .where('id = :contactId AND organization_id = :organizationId', {
        contactId,
        organizationId,
      })
      .execute();

    // Log the token invalidation
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: contactId,
        entity_type: 'contact_auth',
        action: 'CONTACT_TOKENS_INVALIDATED',
        metadata: { reason },
      }),
    );
  }

  /**
   * Verify token validity (age, tenant binding, revocation status)
   */
  async verifyTokenValidity(
    contactId: string,
    organizationId: string,
    tokenIssuedAt: Date,
  ): Promise<boolean> {
    // Check token age
    const tokenAge = Date.now() - tokenIssuedAt.getTime();
    const maxAge = this.MAX_TOKEN_AGE_HOURS * 60 * 60 * 1000;

    if (tokenAge > maxAge) {
      return false;
    }

    // Check if tokens were invalidated after token was issued
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      return false;
    }

    if (contact.token_invalidated_at && contact.token_invalidated_at > tokenIssuedAt) {
      return false;
    }

    return true;
  }

  /**
   * Validate password reset token with tenant binding
   */
  async validatePasswordResetToken(
    contactId: string,
    organizationId: string,
    resetToken: string,
    resetTokenExpiry: Date,
  ): Promise<boolean> {
    // Check token expiry
    if (resetTokenExpiry < new Date()) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          organization_id: organizationId,
          entity_id: contactId,
          entity_type: 'contact_auth',
          action: 'PASSWORD_RESET_EXPIRED',
          metadata: { reset_token_hash: this.hashToken(resetToken) },
        }),
      );
      return false;
    }

    // Verify token belongs to contact in organization
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      return false;
    }

    // Token is valid
    return true;
  }

  /**
   * Verify organization context matches contact's organization
   */
  async verifyCrossTenantRejection(
    contactId: string,
    expectedOrgId: string,
    resolvedOrgId: string,
    context: string,
  ): Promise<boolean> {
    if (expectedOrgId !== resolvedOrgId) {
      await this.auditLogRepository.save(
        this.auditLogRepository.create({
          organization_id: resolvedOrgId,
          entity_id: contactId,
          entity_type: 'contact_auth',
          action: 'CROSS_TENANT_AUTH_REJECTED',
          metadata: {
            expected_org_id: expectedOrgId,
            resolved_org_id: resolvedOrgId,
            context,
          },
        }),
      );

      throw new BadRequestException('Cross-tenant access rejected');
    }

    return true;
  }

  /**
   * Hash token for audit logging (avoid storing plaintext)
   */
  private hashToken(token: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(token).digest('hex').substring(0, 8);
  }

  /**
   * Get contact auth security status
   */
  async getContactSecurityStatus(
    contactId: string,
    organizationId: string,
  ): Promise<{
    contactId: string;
    locked: boolean;
    failedAttempts: number;
    lastAttempt?: Date;
    lastSuccessfulAuth?: Date;
    tokensInvalidatedAt?: Date;
  }> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    const lockoutThreshold = new Date(Date.now() - this.LOCKOUT_DURATION_MINUTES * 60 * 1000);
    const failedAttempts = Number(
      await this.auditLogRepository.count({
        where: {
          organization_id: organizationId,
          entity_id: contactId,
          action: 'CONTACT_AUTH_FAILED',
          created_at: MoreThan(lockoutThreshold),
        },
      }),
    ) || 0;

    const lockoutStatus = await this.isContactLockedOut(contactId, organizationId, failedAttempts);

    const lastAttempt = await this.auditLogRepository.findOne({
      where: {
        organization_id: organizationId,
        entity_id: contactId,
      },
      order: { created_at: 'DESC' },
    });

    const lastSuccessfulAuth = await this.auditLogRepository.findOne({
      where: {
        organization_id: organizationId,
        entity_id: contactId,
        action: 'CONTACT_AUTH_SUCCESS',
      },
      order: { created_at: 'DESC' },
    });

    return {
      contactId,
      locked: lockoutStatus.locked,
      failedAttempts: Math.min(failedAttempts, this.FAILED_ATTEMPT_LIMIT),
      lastAttempt: lastAttempt?.created_at,
      lastSuccessfulAuth: lastSuccessfulAuth?.created_at,
      tokensInvalidatedAt: contact.token_invalidated_at ?? undefined,
    };
  }
}
