import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformUsersService } from './platform-users.service';
import { OrganizationStatusService } from '../organization/services/organization-status.service';

const buildOrganization = (overrides: Record<string, any> = {}) => ({
  id: 'org-1',
  name: 'Greenfield Academy',
  email: 'admin@greenfield.test',
  subdomain: 'greenfield',
  status: 'active',
  status_reason: null,
  suspended_until: null,
  ...overrides,
});

const buildUser = (overrides: Record<string, any> = {}) => ({
  id: 'user-1',
  organization_id: 'org-1',
  email: 'staff@greenfield.test',
  first_name: 'Jane',
  middle_name: null,
  last_name: 'Doe',
  title: null,
  designation: null,
  role: 'STAFF',
  is_active: true,
  deactivated_at: null,
  two_factor_enabled: false,
  two_factor_secret: null,
  password_hash: '$2b$10$super-secret-hash',
  refresh_token_hash: 'hashed-refresh-token',
  password_reset_token: 'reset-token',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  organization: buildOrganization(),
  ...overrides,
});

describe('PlatformUsersService', () => {
  let userRepository: {
    findOne: jest.Mock;
    update: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let organizationRepository: { findOne: jest.Mock };
  let organizationStatusService: OrganizationStatusService;
  let organizationContextService: { runWithoutContext: jest.Mock };
  let queryBuilder: {
    leftJoin: jest.Mock;
    addSelect: jest.Mock;
    andWhere: jest.Mock;
    where: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
    getOne: jest.Mock;
  };
  let service: PlatformUsersService;

  beforeEach(() => {
    queryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      getOne: jest.fn().mockResolvedValue(null),
    };
    userRepository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    organizationRepository = { findOne: jest.fn() };
    organizationStatusService = new OrganizationStatusService({} as any);
    organizationContextService = {
      runWithoutContext: jest.fn((callback) => callback()),
    };

    service = new PlatformUsersService(
      userRepository as any,
      organizationRepository as any,
      organizationStatusService,
      organizationContextService as any,
    );
  });

  describe('list', () => {
    it('applies defaults, clamps the limit and scopes across tenants explicitly', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[buildUser()], 1]);

      const result = await service.list({ limit: 9999 });

      expect(organizationContextService.runWithoutContext).toHaveBeenCalledTimes(1);
      expect(userRepository.createQueryBuilder).toHaveBeenCalledWith('user');
      expect(queryBuilder.leftJoin).toHaveBeenCalledWith(
        'user.organization',
        'organization',
      );
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('user.created_at', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(100);
      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ id: 'user-1', role: 'STAFF' });
    });

    it('filters by organization, role and active status', async () => {
      await service.list({
        organization_id: 'org-1',
        role: 'ADMIN',
        status: 'active',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'user.organization_id = :organizationId',
        { organizationId: 'org-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.role = :role', {
        role: 'ADMIN',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.is_active = :isActive', {
        isActive: true,
      });
    });

    it('translates the inactive status filter to false', async () => {
      await service.list({ status: 'inactive' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.is_active = :isActive', {
        isActive: false,
      });
    });

    it('matches a partial email and the free-text search', async () => {
      await service.list({ email: 'jane', search: 'doe' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('user.email ILIKE :email', {
        email: '%jane%',
      });
      // The search predicate is wrapped in a Brackets group; the tenant lookup
      // is the guard that it was added at all.
      expect(queryBuilder.andWhere).toHaveBeenCalled();
    });

    it('never projects credential material', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[buildUser()], 1]);

      const result = await service.list({});
      const serialized = JSON.stringify(result.data[0]);

      expect(serialized).not.toContain('password_hash');
      expect(serialized).not.toContain('super-secret-hash');
      expect(serialized).not.toContain('refresh_token_hash');
      expect(serialized).not.toContain('reset-token');
      expect(serialized).not.toContain('two_factor_secret');
    });

    it('reports the organization hard-stop state on each row', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([
        [buildUser({ organization: buildOrganization({ status: 'disabled' }) })],
        1,
      ]);

      const result = await service.list({});

      expect(result.data[0].organization).toMatchObject({
        id: 'org-1',
        status: 'disabled',
        is_blocked: true,
      });
    });
  });

  describe('detail', () => {
    it('throws when the user does not exist', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(service.detail('missing')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('selects the 2FA flag explicitly and reports the boolean only', async () => {
      queryBuilder.getOne.mockResolvedValue(buildUser({ two_factor_enabled: true }));
      organizationRepository.findOne.mockResolvedValue(buildOrganization());

      const result = await service.detail('user-1');

      expect(queryBuilder.addSelect).toHaveBeenCalledWith('user.two_factor_enabled');
      expect(result.user).toMatchObject({
        id: 'user-1',
        two_factor_enabled: true,
      });
      expect(result.organization).toMatchObject({ id: 'org-1', status: 'active' });
      expect(JSON.stringify(result)).not.toContain('super-secret-hash');
      expect(JSON.stringify(result)).not.toContain('two_factor_secret');
    });
  });

  describe('changeStatus', () => {
    it('requires a reason to disable a user', async () => {
      await expect(
        service.changeStatus('user-1', { is_active: false }, { id: 'admin-1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.findOne).not.toHaveBeenCalled();
    });

    it('throws when the user does not exist', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(
        service.changeStatus('missing', { is_active: true }, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('disables a user and revokes their sessions', async () => {
      userRepository.findOne.mockResolvedValue(buildUser());

      const result = await service.changeStatus(
        'user-1',
        { is_active: false, reason: 'compromised credentials' },
        { id: 'admin-1' },
      );

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          is_active: false,
          refresh_token_hash: null,
          deactivated_at: expect.any(Date),
        }),
      );
      expect(result).toMatchObject({
        user_id: 'user-1',
        previous_is_active: true,
        is_active: false,
        changed: true,
        reason: 'compromised credentials',
        changed_by: 'admin-1',
      });
    });

    it('re-enables a user without touching other fields', async () => {
      userRepository.findOne.mockResolvedValue(
        buildUser({ is_active: false, deactivated_at: new Date('2026-02-01') }),
      );

      const result = await service.changeStatus('user-1', { is_active: true }, {});

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({ is_active: true, deactivated_at: null }),
      );
      expect(result).toMatchObject({ is_active: true, changed: true, reason: null });
    });

    it('is a no-op when the status already matches', async () => {
      userRepository.findOne.mockResolvedValue(buildUser({ is_active: true }));

      const result = await service.changeStatus('user-1', { is_active: true }, {});

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(result.changed).toBe(false);
    });
  });

  describe('resetTwoFactor', () => {
    it('throws when the user does not exist', async () => {
      queryBuilder.getOne.mockResolvedValue(null);

      await expect(
        service.resetTwoFactor('missing', {}, {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('clears the full 2FA state and reports the change', async () => {
      queryBuilder.getOne.mockResolvedValue(
        buildUser({ two_factor_enabled: true, two_factor_secret: 'SECRET' }),
      );

      const result = await service.resetTwoFactor(
        'user-1',
        { reason: 'lost authenticator' },
        { id: 'admin-1' },
      );

      expect(userRepository.update).toHaveBeenCalledWith(
        'user-1',
        expect.objectContaining({
          two_factor_enabled: false,
          two_factor_secret: null,
          two_factor_temp_secret: null,
          two_factor_temp_expires_at: null,
          two_factor_recovery_codes: null,
        }),
      );
      expect(result).toMatchObject({
        user_id: 'user-1',
        two_factor_enabled: false,
        changed: true,
        changed_by: 'admin-1',
      });
    });

    it('does not write when 2FA was already off', async () => {
      queryBuilder.getOne.mockResolvedValue(
        buildUser({ two_factor_enabled: false, two_factor_secret: null }),
      );

      const result = await service.resetTwoFactor('user-1', {}, {});

      expect(userRepository.update).not.toHaveBeenCalled();
      expect(result).toMatchObject({ two_factor_enabled: false, changed: false });
    });
  });
});
