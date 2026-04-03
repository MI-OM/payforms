import axios from 'axios';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { NotificationService } from './notification.service';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

jest.mock('axios');

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  findOne: jest.fn(),
  createQueryBuilder: jest.fn(),
});

const createMockContactQueryBuilder = () => ({
  innerJoin: jest.fn().mockReturnThis(),
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  distinct: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
});

describe('NotificationService', () => {
  let service: NotificationService;
  let configService: any;
  let contactRepository: MockRepository;

  const mockConfig = (overrides: Record<string, any> = {}) => {
    const defaults: Record<string, any> = {
      EMAIL_PROVIDER: 'sendgrid',
      SENDGRID_API_KEY: 'sendgrid-key',
      SENDGRID_FROM_EMAIL: 'from@example.com',
      EMAIL_FROM: null,
      MAILGUN_API_KEY: 'mailgun-key',
      MAILGUN_DOMAIN: 'mg.example.com',
      MAILGUN_BASE_URL: 'https://api.mailgun.net/v3',
      MAILGUN_FROM: null,
      BREVO_API_KEY: 'brevo-key',
      BREVO_FROM: null,
      BREVO_API_BASE_URL: 'https://api.brevo.com/v3',
      EMAIL_FROM_NAME: 'Payforms',
    };

    const mergedConfig = { ...defaults, ...overrides };
    configService.get.mockImplementation((key: string) => mergedConfig[key]);
  };

  beforeEach(() => {
    configService = { get: jest.fn() };
    contactRepository = createMockRepository();
    service = new NotificationService(configService as any, contactRepository as any);
    mockConfig();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns contact email if contact exists', async () => {
    contactRepository.findOne.mockResolvedValue({ email: 'user@example.com' });

    const result = await service.getContactEmail('org-1', 'contact-1');

    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'contact-1', organization_id: 'org-1' },
      select: ['email'],
    });
    expect(result).toBe('user@example.com');
  });

  it('returns undefined if contact does not exist', async () => {
    contactRepository.findOne.mockResolvedValue(null);

    const result = await service.getContactEmail('org-1', 'contact-1');

    expect(result).toBeUndefined();
  });

  it('returns unique normalized emails for group contacts', async () => {
    const queryBuilder = createMockContactQueryBuilder();
    queryBuilder.getMany.mockResolvedValue([
      { email: 'A@Example.com ' },
      { email: 'a@example.com' },
      { email: 'b@example.com' },
    ]);
    contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    const result = await service.getGroupContactEmails('org-1', ['group-1', 'group-2']);

    expect(contactRepository.createQueryBuilder).toHaveBeenCalledWith('contact');
    expect(queryBuilder.innerJoin).toHaveBeenCalledWith('contact.groups', 'group');
    expect(queryBuilder.where).toHaveBeenCalledWith('contact.organization_id = :organizationId', { organizationId: 'org-1' });
    expect(queryBuilder.andWhere).toHaveBeenCalledWith('group.id IN (:...groupIds)', { groupIds: ['group-1', 'group-2'] });
    expect(result).toEqual(['a@example.com', 'b@example.com']);
  });

  it('returns empty group email list when no group ids are provided', async () => {
    const result = await service.getGroupContactEmails('org-1', []);

    expect(result).toEqual([]);
    expect(contactRepository.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('throws BadRequestException when SENDGRID_API_KEY is missing', async () => {
    mockConfig({ SENDGRID_API_KEY: null });

    await expect(service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when EMAIL_FROM and SENDGRID_FROM_EMAIL are missing', async () => {
    mockConfig({ EMAIL_FROM: null, SENDGRID_FROM_EMAIL: null });

    await expect(service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>')).rejects.toThrow(BadRequestException);
  });

  it('sends email via SendGrid API', async () => {
    mockConfig({
      EMAIL_PROVIDER: 'sendgrid',
      SENDGRID_API_KEY: 'key',
      SENDGRID_FROM_EMAIL: 'from@example.com',
    });
    (axios.post as any).mockResolvedValue({});

    await service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.sendgrid.com/v3/mail/send',
      {
        personalizations: [
          {
            to: [{ email: 'a@example.com' }],
            subject: 'Subject',
          },
        ],
        from: { email: 'from@example.com' },
        content: [{ type: 'text/html', value: '<p>html</p>' }],
      },
      {
        headers: {
          Authorization: 'Bearer key',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('sends email via Mailgun API', async () => {
    mockConfig({
      EMAIL_PROVIDER: 'mailgun',
      MAILGUN_API_KEY: 'mailgun-key',
      MAILGUN_DOMAIN: 'mg.example.com',
      EMAIL_FROM: 'noreply@example.com',
    });
    (axios.post as any).mockResolvedValue({});

    await service.sendEmail(['a@example.com', 'b@example.com'], 'Subject', '<p>html</p>');

    const [url, body, config] = (axios.post as any).mock.calls[0];
    expect(url).toBe('https://api.mailgun.net/v3/mg.example.com/messages');
    expect(body).toContain('from=noreply%40example.com');
    expect(body).toContain('to=a%40example.com');
    expect(body).toContain('to=b%40example.com');
    expect(config).toEqual({
      auth: {
        username: 'api',
        password: 'mailgun-key',
      },
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  });

  it('auto-selects mailgun when EMAIL_PROVIDER is not set but Mailgun config exists', async () => {
    mockConfig({
      EMAIL_PROVIDER: null,
      MAILGUN_API_KEY: 'mailgun-key',
      MAILGUN_DOMAIN: 'mg.example.com',
      EMAIL_FROM: 'noreply@example.com',
    });
    (axios.post as any).mockResolvedValue({});

    await service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>');

    expect((axios.post as any).mock.calls[0][0]).toBe('https://api.mailgun.net/v3/mg.example.com/messages');
  });

  it('sends email via Brevo API', async () => {
    mockConfig({
      EMAIL_PROVIDER: 'brevo',
      BREVO_API_KEY: 'brevo-key',
      EMAIL_FROM: 'noreply@example.com',
      EMAIL_FROM_NAME: 'Payforms Team',
    });
    (axios.post as any).mockResolvedValue({});

    await service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>');

    expect(axios.post).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: {
          email: 'noreply@example.com',
          name: 'Payforms Team',
        },
        to: [{ email: 'a@example.com' }],
        subject: 'Subject',
        htmlContent: '<p>html</p>',
      },
      {
        headers: {
          'api-key': 'brevo-key',
          'Content-Type': 'application/json',
        },
      },
    );
  });

  it('throws InternalServerErrorException when axios call fails', async () => {
    mockConfig({
      EMAIL_PROVIDER: 'sendgrid',
      SENDGRID_API_KEY: 'key',
      SENDGRID_FROM_EMAIL: 'from@example.com',
    });
    (axios.post as any).mockRejectedValue(new Error('fail'));

    await expect(service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>')).rejects.toThrow(InternalServerErrorException);
  });

  it('sends payment confirmation email', async () => {
    const sendSpy = jest.spyOn(service as any, 'sendEmail').mockResolvedValue(undefined);
    const organization = { name: 'Org', logo_url: 'https://logo' } as any;

    await service.sendPaymentConfirmation(organization, 'a@example.com', 1000, 'ref');

    expect(sendSpy).toHaveBeenCalledWith(
      ['a@example.com'],
      'Org Payment Confirmation',
      expect.stringContaining('Thank you for your payment to Org'),
    );
  });

  it('sends submission confirmation email', async () => {
    const sendSpy = jest.spyOn(service as any, 'sendEmail').mockResolvedValue(undefined);
    const organization = { name: 'Org' } as any;

    await service.sendSubmissionConfirmation(organization, 'a@example.com', 'Test Form', 500, 'ref');

    expect(sendSpy).toHaveBeenCalledWith(
      ['a@example.com'],
      'Org Submission Received',
      expect.stringContaining('submission for <strong>Test Form</strong>'),
    );
  });

  it('sends failed payment reminder email', async () => {
    const sendSpy = jest.spyOn(service as any, 'sendEmail').mockResolvedValue(undefined);
    const organization = { name: 'Org' } as any;

    await service.sendFailedPaymentReminder(organization, 'a@example.com', 500, 'ref');

    expect(sendSpy).toHaveBeenCalledWith(
      ['a@example.com'],
      'Org Payment Attempt Failed',
      expect.stringContaining('Your payment attempt for Org was not successful.'),
    );
  });

  it('sends a reminder email', async () => {
    const sendSpy = jest.spyOn(service as any, 'sendEmail').mockResolvedValue(undefined);

    await service.sendReminder(['a@example.com'], 'Please pay');

    expect(sendSpy).toHaveBeenCalledWith(['a@example.com'], 'Payment Reminder', '<p>Please pay</p>');
  });

  it('throws when EMAIL_PROVIDER is invalid', async () => {
    mockConfig({ EMAIL_PROVIDER: 'unknown' });

    await expect(service.sendEmail(['a@example.com'], 'Subject', '<p>html</p>')).rejects.toThrow(BadRequestException);
  });
});
