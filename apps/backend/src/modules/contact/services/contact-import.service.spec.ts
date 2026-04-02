import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ContactImportService } from './contact-import.service';
import { Contact } from '../entities/contact.entity';
import { ContactImport, ContactImportStatus } from '../entities/contact-import.entity';
import { Organization } from '../../organization/entities/organization.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  find: jest.fn(),
  findAndCount: jest.fn(),
});

const mockContactService = () => ({
  bulkImport: jest.fn(),
});

const mockNotificationService = () => ({
  sendPasswordResetEmail: jest.fn(),
});

const mockConfigService = () => ({
  get: jest.fn(),
});

describe('ContactImportService', () => {
  let service: ContactImportService;
  let contactImportRepository: MockRepository;
  let contactRepository: MockRepository;
  let groupRepository: MockRepository;
  let organizationRepository: MockRepository;
  let contactService: ReturnType<typeof mockContactService>;
  let notificationService: ReturnType<typeof mockNotificationService>;
  let configService: ReturnType<typeof mockConfigService>;

  beforeEach(() => {
    contactImportRepository = createMockRepository();
    contactRepository = createMockRepository();
    groupRepository = createMockRepository();
    organizationRepository = createMockRepository();
    contactService = mockContactService();
    notificationService = mockNotificationService();
    configService = mockConfigService();

    service = new ContactImportService(
      contactImportRepository as any,
      contactRepository as any,
      groupRepository as any,
      organizationRepository as any,
      contactService as any,
      notificationService as any,
      configService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('commits an import and sends password reset emails for imported contacts requiring reset', async () => {
    const organization = { id: 'org-1', name: 'Org 1' } as Organization;
    const importJob = {
      id: 'import-1',
      organization_id: 'org-1',
      status: ContactImportStatus.VALIDATED,
      total_count: 1,
      payload: [{ first_name: 'Alice', email: 'alice@example.com', must_reset_password: true }],
      success_count: 0,
      failure_count: 0,
      completed_at: null,
      errors: [],
    } as ContactImport;

    const createdContacts = [
      {
        id: 'contact-1',
        email: 'alice@example.com',
        must_reset_password: true,
        password_reset_token: 'token-123',
      } as Contact,
    ];

    contactImportRepository.findOne.mockResolvedValue(importJob);
    contactService.bulkImport.mockResolvedValue(createdContacts);
    organizationRepository.findOne.mockResolvedValue(organization);
    configService.get.mockReturnValue('https://frontend.example');
    contactImportRepository.save.mockResolvedValue(true);
    notificationService.sendPasswordResetEmail.mockResolvedValue(undefined);

    const result = await service.commitImport('org-1', 'import-1');

    expect(contactService.bulkImport).toHaveBeenCalledWith('org-1', importJob.payload);
    expect(notificationService.sendPasswordResetEmail).toHaveBeenCalledWith(
      organization,
      'alice@example.com',
      'https://frontend.example/contact-reset?token=token-123',
    );
    expect(contactImportRepository.save).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ import_id: 'import-1', status: ContactImportStatus.COMPLETED, created_count: 1 });
  });

  it('throws NotFoundException when commitImport cannot find the import job', async () => {
    contactImportRepository.findOne.mockResolvedValue(null);

    await expect(service.commitImport('org-1', 'missing-import')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when importing a non-validated job', async () => {
    const importJob = {
      id: 'import-2',
      organization_id: 'org-1',
      status: ContactImportStatus.FAILED,
    } as ContactImport;

    contactImportRepository.findOne.mockResolvedValue(importJob);

    await expect(service.commitImport('org-1', 'import-2')).rejects.toThrow(BadRequestException);
  });
});
