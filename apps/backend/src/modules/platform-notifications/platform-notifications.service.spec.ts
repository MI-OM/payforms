import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Brackets } from 'typeorm';
import { PlatformNotificationsService } from './platform-notifications.service';

const buildOrganization = (overrides: Record<string, any> = {}) => ({
  id: 'org-1',
  name: 'Greenfield Academy',
  email: 'billing@greenfield.test',
  billing_plan_tier: 'professional',
  status: 'active',
  suspended_until: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  ...overrides,
});

describe('PlatformNotificationsService', () => {
  const actor = { id: 'platform-1', email: 'admin@payforms.com.ng', role: 'SUPER' };

  let orgQueryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getMany: jest.Mock;
  };
  let notificationQueryBuilder: {
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    skip: jest.Mock;
    take: jest.Mock;
    getManyAndCount: jest.Mock;
  };
  let notificationRepository: {
    create: jest.Mock;
    save: jest.Mock;
    findOne: jest.Mock;
    createQueryBuilder: jest.Mock;
  };
  let deliveryRepository: { insert: jest.Mock; findAndCount: jest.Mock };
  let organizationRepository: { findOne: jest.Mock; createQueryBuilder: jest.Mock };
  let userRepository: { find: jest.Mock };
  let emailService: { sendEmail: jest.Mock };
  let service: PlatformNotificationsService;

  beforeEach(() => {
    orgQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    };
    notificationQueryBuilder = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    notificationRepository = {
      create: jest.fn((value) => ({ id: 'notif-1', ...value })),
      save: jest.fn().mockImplementation(async (value) => value),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => notificationQueryBuilder),
    };
    deliveryRepository = {
      insert: jest.fn().mockResolvedValue(undefined),
      findAndCount: jest.fn().mockResolvedValue([[], 0]),
    };
    organizationRepository = {
      findOne: jest.fn(),
      createQueryBuilder: jest.fn(() => orgQueryBuilder),
    };
    userRepository = { find: jest.fn().mockResolvedValue([]) };
    emailService = { sendEmail: jest.fn().mockResolvedValue(undefined) };

    service = new PlatformNotificationsService(
      notificationRepository as any,
      deliveryRepository as any,
      organizationRepository as any,
      userRepository as any,
      emailService as any,
    );
  });

  describe('compose', () => {
    it('requires a segment when audience_type is SEGMENT', async () => {
      await expect(
        service.compose(
          { subject: 'Hello', body: '<p>hi</p>', audience_type: 'SEGMENT' } as any,
          actor,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(notificationRepository.save).not.toHaveBeenCalled();
    });

    it('sends one email per active admin and records deliveries', async () => {
      orgQueryBuilder.getMany.mockResolvedValue([
        buildOrganization({ id: 'org-1' }),
        buildOrganization({ id: 'org-2', email: 'billing@lakeside.test' }),
      ]);
      userRepository.find.mockResolvedValue([
        { id: 'user-1', email: 'Admin@Greenfield.test', organization_id: 'org-1' },
        { id: 'user-2', email: 'admin@greenfield.test', organization_id: 'org-1' },
        { id: 'user-3', email: 'owner@lakeside.test', organization_id: 'org-2' },
      ]);

      const result = await service.compose(
        { subject: 'Maintenance', body: '<p>Window</p>', audience_type: 'ALL' } as any,
        actor,
      );

      // Duplicate admin email within an org is collapsed.
      expect(emailService.sendEmail).toHaveBeenCalledTimes(2);
      expect(emailService.sendEmail).toHaveBeenCalledWith(
        ['admin@greenfield.test'],
        'Maintenance',
        expect.stringContaining('<p>Window</p>'),
      );
      expect(deliveryRepository.insert).toHaveBeenCalledTimes(1);
      const inserted = deliveryRepository.insert.mock.calls[0][0];
      expect(inserted).toHaveLength(2);
      expect(inserted[0]).toMatchObject({ status: 'sent', organization_id: 'org-1' });
      expect(result.delivery).toEqual({ total: 2, sent: 2, failed: 0, skipped: 0 });
      expect(result.notification).toMatchObject({ status: 'sent', sent_count: 2 });
      expect(result.recipients).toBeUndefined();
    });

    it('dry_run resolves recipients without sending and reports them back', async () => {
      orgQueryBuilder.getMany.mockResolvedValue([buildOrganization()]);
      userRepository.find.mockResolvedValue([
        { id: 'user-1', email: 'admin@greenfield.test', organization_id: 'org-1' },
      ]);

      const result = await service.compose(
        { subject: 'Preview', body: '<p>x</p>', audience_type: 'ALL', dry_run: true } as any,
        actor,
      );

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(result.notification).toMatchObject({ status: 'dry_run', skipped_count: 1 });
      expect(result.delivery).toEqual({ total: 1, sent: 0, failed: 0, skipped: 1 });
      expect(result.recipients).toEqual([
        { organization_id: 'org-1', email: 'admin@greenfield.test' },
      ]);
    });

    it('falls back to the organization email when there are no admins', async () => {
      orgQueryBuilder.getMany.mockResolvedValue([buildOrganization()]);
      userRepository.find.mockResolvedValue([]);

      await service.compose(
        { subject: 'Hi', body: '<p>x</p>', audience_type: 'ALL' } as any,
        actor,
      );

      expect(emailService.sendEmail).toHaveBeenCalledWith(
        ['billing@greenfield.test'],
        'Hi',
        expect.any(String),
      );
    });

    it('captures per-recipient failures and marks the run partial', async () => {
      orgQueryBuilder.getMany.mockResolvedValue([buildOrganization({ id: 'org-1' })]);
      userRepository.find.mockResolvedValue([
        { id: 'user-1', email: 'good@greenfield.test', organization_id: 'org-1' },
      ]);
      emailService.sendEmail.mockRejectedValueOnce(new Error('provider down'));

      const result = await service.compose(
        { subject: 'Hi', body: '<p>x</p>', audience_type: 'ALL' } as any,
        actor,
      );

      expect(result.delivery).toEqual({ total: 1, sent: 0, failed: 1, skipped: 0 });
      expect(result.notification).toMatchObject({ status: 'failed' });
      const inserted = deliveryRepository.insert.mock.calls[0][0];
      expect(inserted[0]).toMatchObject({ status: 'failed', error: 'provider down' });
    });

    it('marks the run failed when there are no recipients at all', async () => {
      orgQueryBuilder.getMany.mockResolvedValue([]);

      const result = await service.compose(
        { subject: 'Hi', body: '<p>x</p>', audience_type: 'ALL' } as any,
        actor,
      );

      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(deliveryRepository.insert).not.toHaveBeenCalled();
      expect(result.notification).toMatchObject({ status: 'failed', total_recipients: 0 });
    });

    it('applies plan and status filters for a segment', async () => {
      await service.compose(
        {
          subject: 'Hi',
          body: '<p>x</p>',
          audience_type: 'SEGMENT',
          segment: { plan: 'Professional', status: 'active' },
        } as any,
        actor,
      );

      expect(orgQueryBuilder.andWhere).toHaveBeenCalledWith(
        'org.billing_plan_tier = :plan',
        { plan: 'professional' },
      );
      const sql = orgQueryBuilder.andWhere.mock.calls
        .map(([condition]) => condition)
        .join(' | ');
      expect(sql).toContain('suspended_until <= :segmentNow');
    });
  });

  describe('notifyOrganization', () => {
    it('throws when the organization does not exist', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(
        service.notifyOrganization('missing', { subject: 'Hi', body: '<p>x</p>' } as any, actor),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('sends to the organization admins and scopes the record to that org', async () => {
      organizationRepository.findOne.mockResolvedValue(buildOrganization());
      userRepository.find.mockResolvedValue([
        { id: 'user-1', email: 'admin@greenfield.test', organization_id: 'org-1' },
      ]);

      const result = await service.notifyOrganization(
        'org-1',
        { subject: 'Payment failed', body: '<p>Update card</p>' } as any,
        actor,
      );

      expect(notificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({ audience_type: 'ORGANIZATION', organization_id: 'org-1' }),
      );
      expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
      expect(result.notification).toMatchObject({ status: 'sent', audience_type: 'ORGANIZATION' });
    });
  });

  describe('list', () => {
    it('applies filters, clamps the limit and paginates', async () => {
      notificationQueryBuilder.getManyAndCount.mockResolvedValue([
        [{ id: 'notif-1', subject: 'Hi' }],
        1,
      ]);

      const result = await service.list({
        status: 'sent',
        audience_type: 'ALL',
        search: 'maint',
        from: '2026-10-01T00:00:00.000Z',
        to: '2026-10-31T23:59:59.999Z',
        page: 2,
        limit: 9999,
      } as any);

      expect(notificationQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.status = :status',
        { status: 'sent' },
      );
      expect(notificationQueryBuilder.andWhere).toHaveBeenCalledWith(
        'notification.audience_type = :audienceType',
        { audienceType: 'ALL' },
      );
      const searchCall = notificationQueryBuilder.andWhere.mock.calls.find(
        ([condition]) => condition instanceof Brackets,
      );
      expect(searchCall).toBeDefined();
      expect(notificationQueryBuilder.take).toHaveBeenCalledWith(100);
      expect(notificationQueryBuilder.skip).toHaveBeenCalledWith(100);
      expect(result).toMatchObject({ total: 1, page: 2, limit: 100 });
    });
  });

  describe('detail', () => {
    it('throws when the notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);
      await expect(service.detail('missing', {})).rejects.toBeInstanceOf(NotFoundException);
    });

    it('returns the notification with paginated deliveries', async () => {
      notificationRepository.findOne.mockResolvedValue({ id: 'notif-1', subject: 'Hi' });
      deliveryRepository.findAndCount.mockResolvedValue([[{ id: 'del-1' }], 1]);

      const result = await service.detail('notif-1', { status: 'failed', page: 1, limit: 50 });

      expect(deliveryRepository.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { notification_id: 'notif-1', status: 'failed' },
          take: 50,
        }),
      );
      expect(result.notification).toMatchObject({ id: 'notif-1' });
      expect(result.deliveries).toMatchObject({ total: 1, page: 1, limit: 50 });
    });
  });
});
