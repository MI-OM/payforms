import { BadRequestException } from '@nestjs/common';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  const configService = {
    get: jest.fn(),
  };
  const contactRepository = {
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const userRepository = {
    find: jest.fn(),
  };
  const internalNotificationRepository = {
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
  const contactNotificationRepository = {
    save: jest.fn(),
    create: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new NotificationService(
      configService as any,
      contactRepository as any,
      userRepository as any,
      internalNotificationRepository as any,
      contactNotificationRepository as any,
    );
  });

  describe('createContactNotification', () => {
    it('creates selected-contact notification for valid contact ids', async () => {
      contactRepository.find.mockResolvedValue([
        { id: 'contact-1', email: 'one@example.com' },
        { id: 'contact-2', email: 'two@example.com' },
      ]);
      contactNotificationRepository.create.mockImplementation((payload: any) => payload);
      contactNotificationRepository.save.mockResolvedValue({
        id: 'notif-1',
        organization_id: 'org-1',
        title: 'Payment Reminder',
        body: 'Please pay',
        type: 'REMINDER',
        audience_type: 'SELECTED_CONTACTS',
        target_contact_ids: ['contact-1', 'contact-2'],
        read_by_contact_ids: [],
        created_by_user_id: 'user-1',
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        metadata: null,
      });

      const result = await service.createContactNotification('org-1', 'user-1', {
        title: 'Payment Reminder',
        body: 'Please pay',
        type: 'REMINDER',
        contact_ids: ['contact-1', 'contact-2', 'missing-contact'],
      });

      expect(contactNotificationRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          organization_id: 'org-1',
          audience_type: 'SELECTED_CONTACTS',
          target_contact_ids: ['contact-1', 'contact-2'],
          type: 'REMINDER',
        }),
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('notif-1');
      expect(result?.target_contact_ids).toEqual(['contact-1', 'contact-2']);
    });

    it('rejects missing title/body', async () => {
      await expect(
        service.createContactNotification('org-1', 'user-1', {
          title: '',
          body: 'Message',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('listContactNotifications', () => {
    it('lists unread notifications visible to a contact', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'notif-1',
              title: 'Payment Confirmed',
              body: 'Your payment was confirmed',
              type: 'PAYMENT_STATUS',
              audience_type: 'SELECTED_CONTACTS',
              target_contact_ids: ['contact-1'],
              read_by_contact_ids: [],
              created_by_user_id: null,
              created_at: new Date('2026-01-01T00:00:00.000Z'),
              metadata: { payment_id: 'payment-1' },
            },
          ],
          1,
        ]),
      };
      contactNotificationRepository.createQueryBuilder.mockReturnValue(qb);

      const result = await service.listContactNotifications('org-1', 'contact-1', 1, 20, true);

      expect(qb.andWhere).toHaveBeenCalledTimes(2);
      expect(result.total).toBe(1);
      expect(result.data[0]).toEqual(
        expect.objectContaining({
          id: 'notif-1',
          is_read: false,
          type: 'PAYMENT_STATUS',
        }),
      );
    });
  });

  describe('markContactNotificationRead', () => {
    it('marks a contact notification as read', async () => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue({
          id: 'notif-1',
          title: 'Reminder',
          body: 'Please pay',
          type: 'REMINDER',
          audience_type: 'SELECTED_CONTACTS',
          target_contact_ids: ['contact-1'],
          read_by_contact_ids: ['contact-2'],
          created_by_user_id: 'user-1',
          created_at: new Date('2026-01-01T00:00:00.000Z'),
          metadata: null,
        }),
      };
      contactNotificationRepository.createQueryBuilder.mockReturnValue(qb);
      contactNotificationRepository.save.mockImplementation(async (payload: any) => payload);

      const result = await service.markContactNotificationRead('org-1', 'contact-1', 'notif-1');

      expect(contactNotificationRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          read_by_contact_ids: ['contact-2', 'contact-1'],
        }),
      );
      expect(result.is_read).toBe(true);
    });
  });
});
