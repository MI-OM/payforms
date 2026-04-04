import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ContactAuthHardeningService } from './contact-auth-hardening.service';
import { Contact } from '../../contact/entities/contact.entity';
import { ActivityLog } from '../../audit/entities/activity-log.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

describe('ContactAuthHardeningService', () => {
  let service: ContactAuthHardeningService;
  let contactRepository;
  let auditLogRepository;

  const mockContact = {
    id: 'contact-123',
    organization_id: 'org-123',
    email: 'user@example.com',
    token_invalidated_at: null,
  };

  beforeEach(async () => {
    contactRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              execute: jest.fn(),
            }),
          }),
        }),
      }),
    };

    auditLogRepository = {
      save: jest.fn(),
      create: jest.fn((dto) => dto),
      count: jest.fn(),
      findOne: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactAuthHardeningService,
        {
          provide: getRepositoryToken(Contact),
          useValue: contactRepository,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: auditLogRepository,
        },
      ],
    }).compile();

    service = module.get<ContactAuthHardeningService>(ContactAuthHardeningService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('isContactLockedOut', () => {
    it('should return not locked when no failed attempts', async () => {
      auditLogRepository.count.mockResolvedValueOnce(0);

      const result = await service.isContactLockedOut('contact-123', 'org-123');

      expect(result.locked).toBe(false);
    });

    it('should return locked when failed attempts exceed limit', async () => {
      auditLogRepository.count.mockResolvedValueOnce(5);
      auditLogRepository.findOne.mockResolvedValueOnce({
        created_at: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
      });

      const result = await service.isContactLockedOut('contact-123', 'org-123');

      expect(result.locked).toBe(true);
      expect(result.remainingMinutes).toBeGreaterThan(0);
    });

    it('should clear expired attempts and return not locked', async () => {
      auditLogRepository.count.mockResolvedValueOnce(5);
      auditLogRepository.findOne.mockResolvedValueOnce({
        created_at: new Date(Date.now() - 20 * 60 * 1000), // 20 minutes ago (beyond lockout)
      });
      auditLogRepository.delete.mockResolvedValueOnce({});

      const result = await service.isContactLockedOut('contact-123', 'org-123');

      expect(result.locked).toBe(false);
      expect(auditLogRepository.delete).toHaveBeenCalled();
    });
  });

  describe('recordFailedAttempt', () => {
    it('should save failed attempt to audit log', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.recordFailedAttempt('contact-123', 'org-123', '192.168.1.1');

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-123',
          entity_id: 'contact-123',
          action: 'CONTACT_AUTH_FAILED',
        }),
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('recordSuccessfulAttempt', () => {
    it('should clear failed attempts and log success', async () => {
      auditLogRepository.delete.mockResolvedValueOnce({});
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.recordSuccessfulAttempt('contact-123', 'org-123', '192.168.1.1');

      expect(auditLogRepository.delete).toHaveBeenCalled();
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_AUTH_SUCCESS',
        }),
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
    });
  });

  describe('invalidateContactTokens', () => {
    it('should update token_invalidated_at and log the action', async () => {
      const execute = jest.fn();
      contactRepository.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue({
          set: jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
              execute,
            }),
          }),
        }),
      });
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.invalidateContactTokens('contact-123', 'org-123', 'password_changed');

      expect(execute).toHaveBeenCalled();
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_TOKENS_INVALIDATED',
          metadata: { reason: 'password_changed' },
        }),
      );
    });
  });

  describe('verifyTokenValidity', () => {
    it('should return true for valid token', async () => {
      const now = new Date();
      contactRepository.findOne.mockResolvedValueOnce({
        ...mockContact,
        token_invalidated_at: null,
      });

      const result = await service.verifyTokenValidity('contact-123', 'org-123', now);

      expect(result).toBe(true);
    });

    it('should return false for expired token', async () => {
      const expiredTime = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      contactRepository.findOne.mockResolvedValueOnce(mockContact);

      const result = await service.verifyTokenValidity('contact-123', 'org-123', expiredTime);

      expect(result).toBe(false);
    });

    it('should return false if contact not found', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.verifyTokenValidity('contact-123', 'org-123', new Date());

      expect(result).toBe(false);
    });

    it('should return false if tokens were invalidated after token issued', async () => {
      const tokenIssuedAt = new Date(Date.now() - 5 * 60 * 1000);
      const tokenInvalidatedAt = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      contactRepository.findOne.mockResolvedValueOnce({
        ...mockContact,
        token_invalidated_at: tokenInvalidatedAt,
      });

      const result = await service.verifyTokenValidity('contact-123', 'org-123', tokenIssuedAt);

      expect(result).toBe(false);
    });
  });

  describe('validatePasswordResetToken', () => {
    it('should return true for valid reset token', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 60 * 1000);
      contactRepository.findOne.mockResolvedValueOnce(mockContact);

      const result = await service.validatePasswordResetToken(
        'contact-123',
        'org-123',
        'reset-token',
        futureExpiry,
      );

      expect(result).toBe(true);
    });

    it('should return false for expired reset token', async () => {
      const pastExpiry = new Date(Date.now() - 60 * 60 * 1000);
      auditLogRepository.save.mockResolvedValueOnce({});

      const result = await service.validatePasswordResetToken(
        'contact-123',
        'org-123',
        'reset-token',
        pastExpiry,
      );

      expect(result).toBe(false);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_EXPIRED',
        }),
      );
    });

    it('should return false if contact not found', async () => {
      const futureExpiry = new Date(Date.now() + 60 * 60 * 1000);
      contactRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.validatePasswordResetToken(
        'contact-123',
        'org-123',
        'reset-token',
        futureExpiry,
      );

      expect(result).toBe(false);
    });
  });

  describe('verifyCrossTenantRejection', () => {
    it('should return true when orgs match', async () => {
      const result = await service.verifyCrossTenantRejection(
        'contact-123',
        'org-123',
        'org-123',
        'login',
      );

      expect(result).toBe(true);
    });

    it('should throw when orgs do not match', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      await expect(
        service.verifyCrossTenantRejection('contact-123', 'org-123', 'org-456', 'login'),
      ).rejects.toThrow('Cross-tenant access rejected');

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CROSS_TENANT_AUTH_REJECTED',
        }),
      );
    });
  });

  describe('getContactSecurityStatus', () => {
    it('should return security status for contact', async () => {
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      auditLogRepository.count.mockResolvedValueOnce(2);
      auditLogRepository.findOne.mockResolvedValueOnce({
        created_at: new Date(),
      });
      auditLogRepository.findOne.mockResolvedValueOnce({
        created_at: new Date(Date.now() - 60 * 60 * 1000),
      });

      const status = await service.getContactSecurityStatus('contact-123', 'org-123');

      expect(status.locked).toBe(false);
      expect(status.failedAttempts).toBe(2);
      expect(status.contactId).toBe('contact-123');
    });

    it('should throw if contact not found', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.getContactSecurityStatus('contact-123', 'org-123'),
      ).rejects.toThrow('Contact not found');
    });
  });
});
