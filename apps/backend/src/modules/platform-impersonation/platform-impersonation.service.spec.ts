import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PlatformImpersonationService } from './platform-impersonation.service';

const buildOrganization = (overrides: Record<string, any> = {}) => ({
  id: 'org-1',
  name: 'Greenfield Academy',
  status: 'active',
  ...overrides,
});

const buildUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  email: 'owner@greenfield.test',
  organization_id: 'org-1',
  role: 'ADMIN',
  first_name: 'Grace',
  middle_name: null,
  last_name: 'Field',
  title: 'Director',
  designation: null,
  is_active: true,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('PlatformImpersonationService', () => {
  const actor = { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' };

  let sessionQueryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let sessionRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let organizationRepository: { findOne: jest.Mock };
  let userRepository: { findOne: jest.Mock };
  let featureFlagsService: { resolve: jest.Mock };
  let jwtService: { sign: jest.Mock };
  let configService: { get: jest.Mock };
  let notificationService: { sendEmail: jest.Mock };
  let service: PlatformImpersonationService;

  beforeEach(() => {
    sessionQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    sessionRepository = {
      create: jest.fn((value) => ({
        id: 'sess-1',
        created_at: new Date('2026-10-15T00:00:00.000Z'),
        ...value,
      })),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => sessionQueryBuilder),
    };
    organizationRepository = { findOne: jest.fn() };
    userRepository = { findOne: jest.fn() };
    featureFlagsService = {
      resolve: jest.fn().mockResolvedValue({ key: 'impersonation', enabled: true, source: 'global' }),
    };
    jwtService = { sign: jest.fn().mockReturnValue('signed-tenant-token') };
    configService = { get: jest.fn() };
    notificationService = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    service = new PlatformImpersonationService(
      sessionRepository as any,
      organizationRepository as any,
      userRepository as any,
      featureFlagsService as any,
      jwtService as any,
      configService as any,
      notificationService as any,
    );
  });

  describe('start', () => {
    it('is blocked when the feature flag disables impersonation', async () => {
      featureFlagsService.resolve.mockResolvedValue({
        key: 'impersonation',
        enabled: false,
        source: 'override',
      });

      await expect(
        service.start('org-1', { reason: 'Investigating ticket #1' } as any, actor),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(sessionRepository.save).not.toHaveBeenCalled();
    });

    it('treats a missing flag as enabled (v1 default)', async () => {
      featureFlagsService.resolve.mockResolvedValue({
        key: 'impersonation',
        enabled: false,
        source: 'missing',
      });
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.findOne.mockResolvedValue(buildUser());

      await expect(
        service.start('org-1', { reason: 'Investigating ticket #1' } as any, actor),
      ).resolves.toMatchObject({ access_token: 'signed-tenant-token' });
    });

    it('throws when the organization does not exist', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.start('missing', { reason: 'Investigating ticket #1' } as any, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when an explicitly requested user is not in the organization', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.start(
          'org-1',
          { reason: 'Investigating ticket #1', user_id: 'other-user' } as any,
          actor,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the organization has no active admin to fall back to', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.start('org-1', { reason: 'Investigating ticket #1' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('records the session, mints a tenant token with an impersonation claim and no refresh token', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.start(
        'org-1',
        { reason: '  Investigating ticket #1  ' } as any,
        actor,
        { ipAddress: '203.0.113.7', userAgent: 'jest' },
      );

      // Falls back to the primary active admin of the organization.
      expect(userRepository.findOne).toHaveBeenCalledWith({
        where: { organization_id: 'org-1', role: 'ADMIN', is_active: true },
        order: { created_at: 'ASC' },
      });

      expect(sessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          platform_user_id: 'platform-1',
          platform_user_email: 'admin@payforms.com.ng',
          organization_id: 'org-1',
          target_user_id: 'user-1',
          status: 'active',
          reason: 'Investigating ticket #1',
          metadata: expect.objectContaining({ duration_minutes: 30, ip_address: '203.0.113.7' }),
        }),
      );

      const [payload, options] = jwtService.sign.mock.calls[0];
      expect(payload).toMatchObject({
        sub: 'user-1',
        organization_id: 'org-1',
        impersonation: {
          session_id: 'sess-1',
          platform_user_id: 'platform-1',
          platform_user_email: 'admin@payforms.com.ng',
        },
      });
      expect(options).toEqual({ expiresIn: '30m' });

      expect(result).not.toHaveProperty('refresh_token');
      expect(result).toMatchObject({ token_type: 'Bearer', access_token: 'signed-tenant-token' });
      expect(result.banner).toMatchObject({ impersonation: true, session_id: 'sess-1' });
      expect(result.user).toMatchObject({ id: 'user-1', email: 'owner@greenfield.test' });
    });

    it('clamps the duration into the allowed range', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.findOne.mockResolvedValue(buildUser());

      await service.start(
        'org-1',
        { reason: 'Investigating ticket #1', duration_minutes: 999 } as any,
        actor,
      );
      expect(jwtService.sign.mock.calls[0][1]).toEqual({ expiresIn: '60m' });
    });
  });

  describe('end', () => {
    it('throws when the session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);
      await expect(service.end('missing', actor)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('refuses to end a session that is already finished', async () => {
      sessionRepository.findOne.mockResolvedValue({ id: 'sess-1', status: 'ended' });
      await expect(service.end('sess-1', actor)).rejects.toBeInstanceOf(BadRequestException);
    });

    it('marks an active session as ended and records who ended it', async () => {
      sessionRepository.findOne.mockResolvedValue({ id: 'sess-1', status: 'active' });

      const result = await service.end('sess-1', actor);

      expect(sessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'ended',
          ended_by_platform_user_id: 'platform-1',
          ended_by_email: 'admin@payforms.com.ng',
        }),
      );
      expect(result.session.status).toBe('ended');
    });
  });

  describe('list', () => {
    it('applies filters, clamps the limit and paginates', async () => {
      sessionQueryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'sess-1' }], 1]);

      const result = await service.list({
        status: 'active',
        organization_id: 'org-1',
        platform_user_id: 'platform-1',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
        page: 2,
        limit: 9999,
      } as any);

      expect(sessionQueryBuilder.andWhere).toHaveBeenCalledWith('session.status = :status', {
        status: 'active',
      });
      expect(sessionQueryBuilder.take).toHaveBeenCalledWith(100);
      expect(sessionQueryBuilder.skip).toHaveBeenCalledWith(100);
      expect(result).toMatchObject({ total: 1, page: 2, limit: 100 });
    });
  });

  describe('detail', () => {
    it('throws when the session does not exist', async () => {
      sessionRepository.findOne.mockResolvedValue(null);
      await expect(service.detail('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the session view', async () => {
      sessionRepository.findOne.mockResolvedValue({ id: 'sess-1', status: 'active' });
      const result = await service.detail('sess-1');
      expect(result.session).toMatchObject({ id: 'sess-1', status: 'active' });
    });
  });
});
