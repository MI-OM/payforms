import { NotificationController } from './notification.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockNotificationService = ReturnType<typeof mockNotificationService>;

const mockNotificationService = () => ({
  getContactEmail: jest.fn(),
  sendReminder: jest.fn(),
  sendEmail: jest.fn(),
});

describe('NotificationController', () => {
  let controller: NotificationController;
  let service: MockNotificationService;

  beforeEach(() => {
    service = mockNotificationService();
    controller = new NotificationController(service as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('sends reminder to filtered recipients', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { contact_ids: ['c1', 'c2'], message: 'Reminder' };
    service.getContactEmail.mockResolvedValueOnce('a@example.com').mockResolvedValueOnce(null);
    service.sendReminder.mockResolvedValue({ success: true });

    const result = await controller.sendReminder(dto as any, req as any);

    expect(service.getContactEmail).toHaveBeenCalledWith('org-1', 'c1');
    expect(service.getContactEmail).toHaveBeenCalledWith('org-1', 'c2');
    expect(service.sendReminder).toHaveBeenCalledWith(['a@example.com'], 'Reminder');
    expect(result).toEqual({ success: true });
  });

  it('schedules notification immediately', async () => {
    const dto = { recipients: ['a@example.com'], subject: 'Subject', body: 'Body' };
    service.sendEmail.mockResolvedValue({ ok: true });

    const result = await controller.schedule(dto as any);

    expect(service.sendEmail).toHaveBeenCalledWith(['a@example.com'], 'Subject', 'Body');
    expect(result).toEqual({ ok: true });
  });
});
