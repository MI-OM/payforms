import { BadRequestException } from '@nestjs/common';
import { NotificationController } from './notification.controller';

describe('NotificationController', () => {
  const notificationService = {
    getContactEmailsInOrganization: jest.fn(),
    sendEmail: jest.fn(),
  };

  let controller: NotificationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationController(notificationService as any);
  });

  it('only sends to recipients that belong to the caller organization', async () => {
    notificationService.getContactEmailsInOrganization.mockResolvedValue(['member@example.com']);
    notificationService.sendEmail.mockResolvedValue({ sent: true });

    const dto = {
      subject: 'Payment Reminder',
      body: 'Please complete your payment',
      recipients: ['member@example.com', 'stranger@example.com'],
    };

    const result = await controller.schedule(dto as any, {
      user: { organization_id: 'org-1' },
    } as any);

    expect(notificationService.getContactEmailsInOrganization).toHaveBeenCalledWith('org-1', [
      'member@example.com',
      'stranger@example.com',
    ]);
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      ['member@example.com'],
      'Payment Reminder',
      'Please complete your payment',
    );
    expect(result).toEqual({ sent: true });
  });

  it('rejects the request when no recipients belong to the organization', async () => {
    notificationService.getContactEmailsInOrganization.mockResolvedValue([]);

    await expect(
      controller.schedule(
        {
          subject: 'Payment Reminder',
          body: 'Please complete your payment',
          recipients: ['stranger@example.com'],
        } as any,
        { user: { organization_id: 'org-1' } } as any,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(notificationService.sendEmail).not.toHaveBeenCalled();
  });
});
