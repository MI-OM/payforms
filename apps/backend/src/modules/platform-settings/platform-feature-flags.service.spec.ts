import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';

describe('PlatformFeatureFlagsService', () => {
  const actor = { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' };

  let queryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let flagRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let overrideRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    find: jest.Mock;
    remove: jest.Mock;
    delete: jest.Mock;
  };
  let organizationRepository: { findOne: jest.Mock };
  let service: PlatformFeatureFlagsService;

  beforeEach(() => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    flagRepository = {
      create: jest.fn((value) => ({ id: 'flag-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    overrideRepository = {
      create: jest.fn((value) => ({ id: 'override-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      remove: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    organizationRepository = { findOne: jest.fn() };
    service = new PlatformFeatureFlagsService(
      flagRepository as any,
      overrideRepository as any,
      organizationRepository as any,
    );
  });

  describe('upsert', () => {
    it('rejects an invalid key', async () => {
      await expect(
        service.upsert('Bad Key!', { enabled: true } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a flag disabled by default then applies the payload', async () => {
      flagRepository.findOne.mockResolvedValue(null);

      const result = await service.upsert(
        'Impersonation',
        { enabled: true, description: 'Allow impersonation' } as any,
        actor,
      );

      expect(flagRepository.create).toHaveBeenCalledWith({
        key: 'impersonation',
        enabled: false,
      });
      expect(result.flag).toMatchObject({
        key: 'impersonation',
        enabled: true,
        description: 'Allow impersonation',
      });
    });
  });

  describe('resolve', () => {
    it('returns disabled with source "missing" for an unknown flag', async () => {
      flagRepository.findOne.mockResolvedValue(null);
      await expect(service.resolve('nope')).resolves.toMatchObject({
        key: 'nope',
        enabled: false,
        source: 'missing',
      });
    });

    it('uses the global default when there is no override', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'impersonation', enabled: true });
      overrideRepository.findOne.mockResolvedValue(null);

      await expect(service.resolve('impersonation', 'org-1')).resolves.toMatchObject({
        enabled: true,
        source: 'global',
      });
    });

    it('lets an organization override win over the global default', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'impersonation', enabled: true });
      overrideRepository.findOne.mockResolvedValue({ enabled: false });

      await expect(service.resolve('impersonation', 'org-1')).resolves.toMatchObject({
        enabled: false,
        source: 'override',
        organization_id: 'org-1',
      });
      await expect(service.isEnabled('impersonation', 'org-1')).resolves.toBe(false);
    });

    it('does not look up overrides when no organization is supplied', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: false });
      await service.resolve('flag');
      expect(overrideRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('setOverride', () => {
    it('throws when the flag does not exist', async () => {
      flagRepository.findOne.mockResolvedValue(null);
      await expect(
        service.setOverride('missing', 'org-1', { enabled: true } as any, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws when the organization does not exist', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: false });
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.setOverride('flag', 'missing-org', { enabled: true } as any, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('creates an override scoped to the organization and stamps the actor', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'impersonation', enabled: false });
      organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
      overrideRepository.findOne.mockResolvedValue(null);

      const result = await service.setOverride(
        'impersonation',
        'org-1',
        { enabled: true, reason: 'Enterprise contract' } as any,
        actor,
      );

      expect(overrideRepository.create).toHaveBeenCalledWith({
        flag_key: 'impersonation',
        organization_id: 'org-1',
      });
      expect(result.override).toMatchObject({
        flag_key: 'impersonation',
        organization_id: 'org-1',
        enabled: true,
        reason: 'Enterprise contract',
        updated_by_platform_user_id: 'platform-1',
      });
    });
  });

  describe('clearOverride', () => {
    it('throws when the override does not exist', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: false });
      overrideRepository.findOne.mockResolvedValue(null);
      await expect(service.clearOverride('flag', 'org-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('removes an existing override', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: false });
      overrideRepository.findOne.mockResolvedValue({ id: 'override-1' });
      await expect(service.clearOverride('flag', 'org-1')).resolves.toEqual({
        flag_key: 'flag',
        organization_id: 'org-1',
        deleted: true,
      });
    });
  });

  describe('remove', () => {
    it('deletes the flag and its overrides', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: true });
      await service.remove('flag');
      expect(overrideRepository.delete).toHaveBeenCalledWith({ flag_key: 'flag' });
      expect(flagRepository.remove).toHaveBeenCalled();
    });
  });

  describe('detail', () => {
    it('returns the flag with its overrides', async () => {
      flagRepository.findOne.mockResolvedValue({ key: 'flag', enabled: true });
      overrideRepository.find.mockResolvedValue([
        { id: 'override-1', flag_key: 'flag', organization_id: 'org-1', enabled: false },
      ]);

      const result = await service.detail('flag');

      expect(result.flag).toMatchObject({ key: 'flag', enabled: true });
      expect(result.overrides).toHaveLength(1);
    });
  });

  describe('list', () => {
    it('filters by enabled and clamps the limit', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'flag-1', key: 'a' }], 1]);

      const result = await service.list({ enabled: true, limit: 9999 } as any);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('flag.enabled = :enabled', {
        enabled: true,
      });
      expect(queryBuilder.take).toHaveBeenCalledWith(100);
      expect(result).toMatchObject({ total: 1, page: 1, limit: 100 });
    });
  });
});
