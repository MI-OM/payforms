import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { PlatformSettingsService } from './platform-settings.service';

describe('PlatformSettingsService', () => {
  const actor = { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' };

  let queryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let settingRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    remove: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let service: PlatformSettingsService;

  beforeEach(() => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    settingRepository = {
      create: jest.fn((value) => ({ id: 'setting-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
      remove: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    service = new PlatformSettingsService(settingRepository as any);
  });

  describe('set', () => {
    it('rejects an invalid key', async () => {
      await expect(
        service.set('Bad Key!', { value: 'x', value_type: 'string' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a value that does not match the declared type', async () => {
      await expect(
        service.set('support.email', { value: 123, value_type: 'string' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.set('retry.count', { value: 'many', value_type: 'number' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.set('maintenance.on', { value: 'yes', value_type: 'boolean' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('creates a new setting, normalising the key and stamping the actor', async () => {
      settingRepository.findOne.mockResolvedValue(null);

      const result = await service.set(
        'Support.Email',
        { value: 'support@payforms.com.ng', value_type: 'string', category: 'EMAIL' } as any,
        actor,
      );

      expect(settingRepository.create).toHaveBeenCalledWith({ key: 'support.email' });
      expect(settingRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: 'support.email',
          value: 'support@payforms.com.ng',
          category: 'EMAIL',
          updated_by_platform_user_id: 'platform-1',
        }),
      );
      expect(result).toMatchObject({ key: 'support.email', value: 'support@payforms.com.ng' });
    });

    it('updates an existing setting without overwriting unset fields', async () => {
      settingRepository.findOne.mockResolvedValue({
        id: 'setting-1',
        key: 'support.email',
        value: 'old@payforms.com.ng',
        value_type: 'string',
        category: 'EMAIL',
        description: 'kept',
        is_secret: false,
      });

      const result = await service.set(
        'support.email',
        { value: 'new@payforms.com.ng', value_type: 'string' } as any,
        actor,
      );

      expect(result).toMatchObject({
        key: 'support.email',
        value: 'new@payforms.com.ng',
        category: 'EMAIL',
        description: 'kept',
      });
    });
  });

  describe('secrecy', () => {
    it('never returns the value of a secret setting', async () => {
      settingRepository.findOne.mockResolvedValue({
        id: 'setting-2',
        key: 'smtp.password',
        value: 'super-secret',
        value_type: 'string',
        category: 'INTEGRATIONS',
        description: null,
        is_secret: true,
      });

      const result = await service.get('smtp.password');

      expect(JSON.stringify(result)).not.toContain('super-secret');
      expect(result).toMatchObject({ is_secret: true, value: null, has_value: true });
    });

    it('exposes the raw value only through the internal helper', async () => {
      settingRepository.findOne.mockResolvedValue({ key: 'smtp.password', value: 'super-secret' });
      await expect(service.getRawValue('SMTP.Password')).resolves.toBe('super-secret');
    });
  });

  describe('get', () => {
    it('throws when the setting does not exist', async () => {
      settingRepository.findOne.mockResolvedValue(null);
      await expect(service.get('missing.key')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('list', () => {
    it('filters, searches, clamps the limit and paginates', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'setting-1', key: 'a.b' }], 1]);

      const result = await service.list({
        category: 'EMAIL',
        search: 'support',
        page: 2,
        limit: 9999,
      } as any);

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('setting.category = :category', {
        category: 'EMAIL',
      });
      const searchCall = queryBuilder.andWhere.mock.calls.find(
        ([condition]) => condition instanceof Brackets,
      );
      expect(searchCall).toBeDefined();
      expect(queryBuilder.take).toHaveBeenCalledWith(100);
      expect(queryBuilder.skip).toHaveBeenCalledWith(100);
      expect(result).toMatchObject({ total: 1, page: 2, limit: 100 });
    });
  });

  describe('remove', () => {
    it('throws when the setting does not exist', async () => {
      settingRepository.findOne.mockResolvedValue(null);
      await expect(service.remove('missing.key')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('removes an existing setting', async () => {
      settingRepository.findOne.mockResolvedValue({ id: 'setting-1', key: 'a.b' });
      await expect(service.remove('a.b')).resolves.toEqual({ key: 'a.b', deleted: true });
      expect(settingRepository.remove).toHaveBeenCalled();
    });
  });
});
