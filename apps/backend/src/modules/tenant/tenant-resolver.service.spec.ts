import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TenantResolverService } from './tenant-resolver.service';
import { Organization } from '../organization/entities/organization.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

describe('TenantResolverService', () => {
  let service: TenantResolverService;
  let organizationRepository;
  let auditLogRepository;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    custom_domain: 'example.com',
    subdomain: 'test',
  };

  beforeEach(async () => {
    organizationRepository = {
      findOne: jest.fn(),
    };

    auditLogRepository = {
      save: jest.fn(),
      create: jest.fn((dto) => dto),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantResolverService,
        {
          provide: getRepositoryToken(Organization),
          useValue: organizationRepository,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: auditLogRepository,
        },
      ],
    }).compile();

    service = module.get<TenantResolverService>(TenantResolverService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveOrganizationFromHost', () => {
    it('should resolve organization by custom domain', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      const result = await service.resolveOrganizationFromHost('example.com');

      expect(result).toEqual({
        organization_id: 'org-123',
        organization: mockOrganization,
      });
      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { custom_domain: 'example.com' },
      });
    });

    it('should resolve organization by subdomain', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(null); // first - custom domain
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization); // second - subdomain

      process.env.TENANT_BASE_DOMAIN = 'payforms.app';

      const result = await service.resolveOrganizationFromHost('test.payforms.app');

      expect(result).toEqual({
        organization_id: 'org-123',
        organization: mockOrganization,
      });
      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { subdomain: 'test' },
      });
    });

    it('should resolve organization by fallback org_id', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(null); // custom domain
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization); // fallback

      const result = await service.resolveOrganizationFromHost('unknown.com', 'org-123');

      expect(result).toEqual({
        organization_id: 'org-123',
        organization: mockOrganization,
      });
      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'org-123' },
      });
    });

    it('should return null if no resolution method succeeds', async () => {
      organizationRepository.findOne.mockResolvedValue(null);

      const result = await service.resolveOrganizationFromHost('unknown.com');

      expect(result).toBeNull();
    });

    it('should handle host with port', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      const result = await service.resolveOrganizationFromHost('example.com:3000');

      expect(result).toEqual({
        organization_id: 'org-123',
        organization: mockOrganization,
      });
      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { custom_domain: 'example.com' },
      });
    });

    it('should be case-insensitive', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      const result = await service.resolveOrganizationFromHost('EXAMPLE.COM');

      expect(result).toEqual({
        organization_id: 'org-123',
        organization: mockOrganization,
      });
      expect(organizationRepository.findOne).toHaveBeenCalledWith({
        where: { custom_domain: 'example.com' },
      });
    });
  });

  describe('verifyTenantMatch', () => {
    it('should return true if tenants match', async () => {
      const result = await service.verifyTenantMatch('org-123', 'org-123', 'test-context');

      expect(result).toBe(true);
    });

    it('should throw BadRequestException if tenants do not match', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      await expect(
        service.verifyTenantMatch('org-123', 'org-456', 'test-context'),
      ).rejects.toThrow('Tenant mismatch: unauthorized access attempt');

      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it('should log tenant mismatch with user_id', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      try {
        await service.verifyTenantMatch('org-123', 'org-456', 'test-context', 'user-789');
      } catch (e) {
        // expected
      }

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-123',
          user_id: 'user-789',
          action: 'TENANT_MISMATCH_REJECTED',
          entity_type: 'auth',
          entity_id: 'test-context',
        }),
      );
    });
  });

  describe('logTenantResolution', () => {
    it('should log tenant resolution event', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.logTenantResolution('org-123', 'test.payforms.app', 'subdomain', 'user-789');

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-123',
          user_id: 'user-789',
          action: 'TENANT_RESOLVED',
          entity_type: 'tenant',
          entity_id: 'test.payforms.app',
        }),
      );
      expect(auditLogRepository.save).toHaveBeenCalled();
    });

    it('should log resolution with different methods', async () => {
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.logTenantResolution('org-123', 'example.com', 'domain');

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { method: 'domain' },
        }),
      );
    });
  });
});
