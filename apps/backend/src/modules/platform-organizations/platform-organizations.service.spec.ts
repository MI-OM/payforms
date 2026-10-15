import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { PlatformOrganizationsService } from './platform-organizations.service';
import { OrganizationStatusService } from '../organization/services/organization-status.service';

const buildOrganization = (overrides: Record<string, any> = {}) => ({
  id: 'org-1',
  name: 'Greenfield Academy',
  email: 'admin@greenfield.test',
  email_verified: true,
  subdomain: 'greenfield',
  custom_domain: null,
  logo_url: null,
  billing_plan_tier: 'professional',
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  status: 'active',
  status_reason: null,
  status_changed_at: null,
  status_changed_by: null,
  suspended_until: null,
  require_contact_login: false,
  notify_submission_confirmation: true,
  notify_payment_confirmation: true,
  notify_payment_failure: true,
  enabled_payment_methods: ['ONLINE'],
  partial_payment_limit: null,
  data_retention_contact_days: 1095,
  data_retention_submission_days: 2555,
  data_retention_audit_days: 2555,
  auto_purge_retention_enabled: true,
  paystack_public_key: 'pk_test_123',
  paystack_secret_key: 'sk_test_super_secret',
  ...overrides,
});

describe('PlatformOrganizationsService', () => {
  let organizationRepository: {
    findOne: jest.Mock;
    save: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let statusEventRepository: {
    insert: jest.Mock;
    find: jest.Mock;
    findAndCount: jest.Mock;
  };
  let userRepository: { count: jest.Mock };
  let contactRepository: { count: jest.Mock };
  let formRepository: { count: jest.Mock };
  let submissionRepository: { count: jest.Mock };
  let paymentRepository: { count: jest.Mock };
  let organizationStatusService: OrganizationStatusService;
  let organizationContextService: { runWithContext: jest.Mock };
  let queryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let service: PlatformOrganizationsService;

  beforeEach(() => {
    queryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    organizationRepository = {
      findOne: jest.fn(),
      save: jest.fn().mockImplementation(async (org) => org),
      createQueryBuilder: jest.fn(() => queryBuilder),
    };
    statusEventRepository = {
      insert: jest.fn().mockResolvedValue(undefined),
      find: jest.fn().mockResolvedValue([]),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    userRepository = { count: jest.fn().mockResolvedValue(0) };
    contactRepository = { count: jest.fn().mockResolvedValue(0) };
    formRepository = { count: jest.fn().mockResolvedValue(0) };
    submissionRepository = { count: jest.fn().mockResolvedValue(0) };
    paymentRepository = { count: jest.fn().mockResolvedValue(0) };
    // Pure methods are exercised for real; the repository is never touched.
    organizationStatusService = new OrganizationStatusService({} as any);
    organizationContextService = {
      runWithContext: jest.fn((_org, _user, callback) => callback()),
    };

    service = new PlatformOrganizationsService(
      organizationRepository as any,
      statusEventRepository as any,
      userRepository as any,
      contactRepository as any,
      formRepository as any,
      submissionRepository as any,
      paymentRepository as any,
      organizationStatusService,
      organizationContextService as any,
    );
  });

  describe('list', () => {
    it('applies defaults and clamps the limit', async () => {
      queryBuilder.getManyAndCount.mockResolvedValue([[buildOrganization()], 1]);

      const result = await service.list({ limit: 9999 });

      expect(organizationRepository.createQueryBuilder).toHaveBeenCalledWith('org');
      expect(queryBuilder.orderBy).toHaveBeenCalledWith('org.created_at', 'DESC');
      expect(queryBuilder.skip).toHaveBeenCalledWith(0);
      expect(queryBuilder.take).toHaveBeenCalledWith(100);
      expect(result.total).toBe(1);
      expect(result.data[0]).toMatchObject({ id: 'org-1', status: 'active' });
    });

    it('filters active organizations, including expired suspensions', async () => {
      await service.list({ status: 'active' });

      const sql = queryBuilder.andWhere.mock.calls
        .map(([condition]) => condition)
        .join(' | ');
      expect(sql).toContain("org.status = 'active'");
      expect(sql).toContain('suspended_until <= :filterNow');
    });

    it('filters suspended organizations, excluding expired ones', async () => {
      await service.list({ status: 'suspended' });

      const sql = queryBuilder.andWhere.mock.calls
        .map(([condition]) => condition)
        .join(' | ');
      expect(sql).toContain("org.status = 'suspended'");
      expect(sql).toContain('suspended_until > :filterNow');
    });

    it('filters disabled organizations by stored status', async () => {
      await service.list({ status: 'disabled' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'org.status = :filterDisabled',
        { filterDisabled: 'disabled' },
      );
    });

    it('filters by plan and searches across identifying columns', async () => {
      await service.list({ plan: 'Professional', search: 'green' });

      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'org.billing_plan_tier = :plan',
        { plan: 'professional' },
      );
      const searchCall = queryBuilder.andWhere.mock.calls.find(
        ([condition]) => condition instanceof Brackets,
      );
      expect(searchCall).toBeDefined();
    });
  });

  describe('detail', () => {
    it('throws when the organization does not exist', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(service.detail('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('returns a curated projection without leaking the Paystack secret', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      statusEventRepository.find.mockResolvedValue([{ id: 'evt-1' }]);
      userRepository.count.mockResolvedValue(3);
      contactRepository.count.mockResolvedValue(120);
      formRepository.count.mockResolvedValue(4);
      submissionRepository.count.mockResolvedValue(500);
      paymentRepository.count.mockResolvedValue(250);

      const result = await service.detail('org-1');
      const serialized = JSON.stringify(result);

      expect(serialized).not.toContain('sk_test_super_secret');
      expect(result.organization.paystack).toEqual({
        has_public_key: true,
        has_secret_key: true,
      });
      expect(result.counts).toEqual({
        users: 3,
        contacts: 120,
        forms: 4,
        submissions: 500,
        payments: 250,
      });
      expect(result.status).toMatchObject({ status: 'active', is_blocked: false });
      expect(result.status_events).toEqual([{ id: 'evt-1' }]);
      // Counts are loaded inside the tenant context so RLS scopes them.
      expect(organizationContextService.runWithContext).toHaveBeenCalledWith(
        'org-1',
        '',
        expect.any(Function),
      );
    });
  });

  describe('changeStatus', () => {
    const actor = { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' };

    it('throws when the organization does not exist', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.changeStatus('missing', { status: 'disabled' } as any, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('requires a reason to suspend or disable', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      await expect(
        service.changeStatus('org-1', { status: 'suspended' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.changeStatus('org-1', { status: 'disabled' } as any, actor),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(statusEventRepository.insert).not.toHaveBeenCalled();
    });

    it('rejects expires_at for a non-suspended status', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      await expect(
        service.changeStatus(
          'org-1',
          { status: 'active', expires_at: '2030-01-01T00:00:00.000Z' } as any,
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects an expires_at in the past', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      await expect(
        service.changeStatus(
          'org-1',
          { status: 'suspended', reason: 'non-payment', expires_at: '2000-01-01T00:00:00.000Z' } as any,
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('suspends an organization, records the event and stamps the actor', async () => {
      const org = buildOrganization();
      organizationRepository.findOne.mockResolvedValue(org);

      const result = await service.changeStatus(
        'org-1',
        { status: 'suspended', reason: 'non-payment' } as any,
        actor,
      );

      expect(organizationRepository.save).toHaveBeenCalled();
      expect(statusEventRepository.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          previous_status: 'active',
          new_status: 'suspended',
          reason: 'non-payment',
          actor_platform_user_id: 'platform-1',
          actor_email: 'admin@payforms.com.ng',
        }),
      );
      expect(result).toMatchObject({
        previous_status: 'active',
        changed: true,
        status: { stored_status: 'suspended', is_blocked: true },
      });
    });

    it('restores a suspended organization and clears reason/expiry', async () => {
      const org = buildOrganization({
        status: 'suspended',
        status_reason: 'non-payment',
        suspended_until: new Date(Date.now() + 60_000),
      });
      organizationRepository.findOne.mockResolvedValue(org);

      const result = await service.changeStatus(
        'org-1',
        { status: 'active' } as any,
        actor,
      );

      expect(org.status_reason).toBeNull();
      expect(org.suspended_until).toBeNull();
      expect(result.status).toMatchObject({ stored_status: 'active', is_blocked: false });
    });

    it('does not write a history event when nothing changes', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());

      const result = await service.changeStatus(
        'org-1',
        { status: 'active' } as any,
        actor,
      );

      expect(result.changed).toBe(false);
      expect(statusEventRepository.insert).not.toHaveBeenCalled();
    });
  });

  describe('listStatusEvents', () => {
    it('throws when the organization does not exist', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.listStatusEvents('missing', {}),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('paginates the history', async () => {
      organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
      statusEventRepository.findAndCount.mockResolvedValue([[{ id: 'evt-1' }], 1]);

      const result = await service.listStatusEvents('org-1', { page: 2, limit: 10 });

      expect(statusEventRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { organization_id: 'org-1' },
          skip: 10,
          take: 10,
        }),
      );
      expect(result).toEqual({ data: [{ id: 'evt-1' }], total: 1, page: 2, limit: 10 });
    });
  });
});
