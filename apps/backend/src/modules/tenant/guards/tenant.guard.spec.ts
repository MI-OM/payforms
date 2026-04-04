import { Test, TestingModule } from '@nestjs/testing';
import { TenantGuard } from './tenant.guard';
import { TenantResolverService } from '../tenant-resolver.service';
import { ExecutionContext, BadRequestException } from '@nestjs/common';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

describe('TenantGuard', () => {
  let guard: TenantGuard;
  let tenantResolverService: TenantResolverService;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TenantGuard,
        {
          provide: TenantResolverService,
          useValue: {
            resolveOrganizationFromHost: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TenantGuard>(TenantGuard);
    tenantResolverService = module.get<TenantResolverService>(TenantResolverService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow request with valid tenant resolution', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            get: (header: string) => (header === 'host' ? 'test.payforms.app' : undefined),
            headers: {},
          }),
        }),
      } as ExecutionContext;

      jest.spyOn(tenantResolverService, 'resolveOrganizationFromHost').mockResolvedValueOnce({
        organization_id: 'org-123',
        organization: mockOrganization,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
    });

    it('should attach organization to request', async () => {
      const request = {
        get: (header: string) => (header === 'host' ? 'test.payforms.app' : undefined),
        headers: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext;

      jest.spyOn(tenantResolverService, 'resolveOrganizationFromHost').mockResolvedValueOnce({
        organization_id: 'org-123',
        organization: mockOrganization,
      });

      await guard.canActivate(mockContext);

      expect(request['organization_id']).toBe('org-123');
      expect(request['organization']).toEqual(mockOrganization);
    });

    it('should throw if organization resolution fails', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            get: (header: string) => (header === 'host' ? 'unknown.com' : undefined),
            headers: {},
          }),
        }),
      } as ExecutionContext;

      jest.spyOn(tenantResolverService, 'resolveOrganizationFromHost').mockResolvedValueOnce(null);

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Unable to resolve organization context',
      );
    });

    it('should handle x-organization-id header', async () => {
      const request = {
        get: (header: string) => (header === 'host' ? 'test.payforms.app' : undefined),
        headers: { 'x-organization-id': 'org-123' },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as ExecutionContext;

      jest.spyOn(tenantResolverService, 'resolveOrganizationFromHost').mockResolvedValueOnce({
        organization_id: 'org-123',
        organization: mockOrganization,
      });

      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(tenantResolverService.resolveOrganizationFromHost).toHaveBeenCalledWith(
        'test.payforms.app',
        'org-123',
      );
    });

    it('should throw if organization_id header mismatches resolved org', async () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            get: (header: string) => (header === 'host' ? 'test.payforms.app' : undefined),
            headers: { 'x-organization-id': 'org-456' },
          }),
        }),
      } as ExecutionContext;

      jest.spyOn(tenantResolverService, 'resolveOrganizationFromHost').mockResolvedValueOnce({
        organization_id: 'org-123',
        organization: mockOrganization,
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        'Organization context mismatch with provided organization_id',
      );
    });
  });
});
