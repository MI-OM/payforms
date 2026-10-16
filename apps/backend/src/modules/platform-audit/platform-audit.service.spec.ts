import { Brackets } from 'typeorm';
import { PlatformAuditService } from './platform-audit.service';

describe('PlatformAuditService', () => {
  let repository: {
    insert: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let queryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let service: PlatformAuditService;

  beforeEach(() => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    repository = {
      insert: jest.fn().mockResolvedValue(undefined),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    service = new PlatformAuditService(repository as any);
  });

  describe('record', () => {
    it('maps a minimal entry to a row with null defaults', async () => {
      await service.record({
        action: 'CREATE ORGANIZATION',
        method: 'POST',
        path: '/platform/organizations',
      });

      expect(repository.insert).toHaveBeenCalledWith({
        actor_id: null,
        actor_email: null,
        actor_role: null,
        action: 'CREATE ORGANIZATION',
        resource_type: null,
        resource_id: null,
        method: 'POST',
        path: '/platform/organizations',
        status_code: null,
        ip_address: null,
        user_agent: null,
        metadata: {},
      });
    });

    it('passes through actor, status and metadata when provided', async () => {
      await service.record({
        actorId: 'platform-1',
        actorEmail: 'admin@payforms.com.ng',
        actorRole: 'SUPER',
        action: 'DISABLE ORGANIZATION',
        resourceType: 'Organization',
        resourceId: 'org-1',
        method: 'PATCH',
        path: '/platform/organizations/org-1/status',
        statusCode: 200,
        ipAddress: '105.112.73.43',
        userAgent: 'jest',
        metadata: { reason: 'fraud' },
      });

      expect(repository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'platform-1',
          actor_email: 'admin@payforms.com.ng',
          actor_role: 'SUPER',
          resource_type: 'Organization',
          resource_id: 'org-1',
          status_code: 200,
          ip_address: '105.112.73.43',
          user_agent: 'jest',
          metadata: { reason: 'fraud' },
        }),
      );
    });

    it('never throws when the insert fails (best-effort auditing)', async () => {
      repository.insert.mockRejectedValueOnce(new Error('db down'));

      await expect(
        service.record({ action: 'X', method: 'POST', path: '/platform/x' }),
      ).resolves.toBeUndefined();
    });
  });

  describe('list', () => {
    it('applies sensible defaults and clamps the limit', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'a' }], 1]);

      const result = await service.list({});

      expect(repository.createQueryBuilder).toHaveBeenCalledWith('log');
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('log.created_at', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(20);
      expect(result).toEqual({ data: [{ id: 'a' }], total: 1, page: 1, limit: 20 });
    });

    it('clamps an oversized limit to 200', async () => {
      await service.list({ limit: 9999 });

      expect(queryBuilder.take).toHaveBeenCalledWith(200);
    });

    it('paginates using page and limit', async () => {
      await service.list({ page: 3, limit: 25 });

      expect(queryBuilder.skip).toHaveBeenCalledWith(50);
      expect(queryBuilder.take).toHaveBeenCalledWith(25);
    });

    it('applies scalar filters', async () => {
      await service.list({
        actor_id: 'platform-1',
        action: 'PLATFORM ADMIN LOGIN',
        resource_type: 'Organization',
        resource_id: 'org-1',
        method: 'post',
        status_code: 403,
        from: '2026-01-01',
        to: '2026-12-31',
      });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.actor_id = :actor_id', {
        actor_id: 'platform-1',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.action = :action', {
        action: 'PLATFORM ADMIN LOGIN',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.resource_type = :resource_type',
        { resource_type: 'Organization' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.resource_id = :resource_id',
        { resource_id: 'org-1' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.method = :method', {
        method: 'POST',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'log.status_code = :status_code',
        { status_code: 403 },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at >= :from', {
        from: '2026-01-01',
      });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('log.created_at <= :to', {
        to: '2026-12-31',
      });
    });

    it('builds a grouped keyword search across several columns', async () => {
      await service.list({ keyword: 'acme' });

      const keywordCall = queryBuilder.andWhere.mock.calls.find(
        ([condition]) => condition instanceof Brackets,
      );
      expect(keywordCall).toBeDefined();
    });
  });

  describe('getById', () => {
    it('returns the row or null', async () => {
      repository.findOne.mockResolvedValueOnce({ id: 'log-1' });

      await expect(service.getById('log-1')).resolves.toEqual({ id: 'log-1' });
      expect(repository.findOne).toHaveBeenCalledWith({ where: { id: 'log-1' } });
    });
  });
});
