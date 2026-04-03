import { NotFoundException } from '@nestjs/common';
import { OrganizationService } from './services/organization.service';
import { Organization } from './entities/organization.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

type MockStorageService = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
});

const createMockStorageService = (): MockStorageService => ({
  getPublicUrl: jest.fn((path: string) => `https://supabase.example.com/public/${path}`),
  uploadFile: jest.fn(async (path: string) => `https://supabase.example.com/public/${path}`),
});

describe('OrganizationService', () => {
  let service: OrganizationService;
  let organizationRepository: MockRepository;
  let storageService: MockStorageService;

  beforeEach(() => {
    organizationRepository = createMockRepository();
    storageService = createMockStorageService();
    service = new OrganizationService(organizationRepository as any, storageService as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates an organization', async () => {
    const dto = { name: 'Org', email: 'admin@org.com' };
    const org = { id: 'org-1', ...dto } as Organization;
    organizationRepository.create.mockReturnValue({ ...dto });
    organizationRepository.save.mockResolvedValue(org);

    const result = await service.create(dto as any);

    expect(organizationRepository.create).toHaveBeenCalledWith(dto);
    expect(result).toEqual(org);
  });

  it('finds an organization by id', async () => {
    const org = { id: 'org-1' } as Organization;
    organizationRepository.findOne.mockResolvedValue(org);

    const result = await service.findById('org-1');

    expect(organizationRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'org-1' },
      select: [
        'id',
        'name',
        'email',
        'email_verified',
        'logo_url',
        'subdomain',
        'custom_domain',
        'require_contact_login',
        'notify_submission_confirmation',
        'notify_payment_confirmation',
        'notify_payment_failure',
        'created_at',
      ],
    });
    expect(result).toEqual(org);
  });

  it('updates organization and returns updated value', async () => {
    const dto = { name: 'New Org', email: 'admin@org.com' };
    const existing = { id: 'org-1', email: 'admin@org.com' } as Organization;
    const updated = { id: 'org-1', ...dto } as Organization;

    organizationRepository.findOne.mockResolvedValue(existing);
    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

    const result = await service.update('org-1', dto as any);

    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', { ...dto });
    expect(result).toEqual(updated);
  });

  it('updates organization email and resets verification fields', async () => {
    const dto = { email: 'new@org.com' };
    const existing = { id: 'org-1', email: 'admin@org.com' } as Organization;
    const updated = { id: 'org-1', email: 'new@org.com', email_verified: false, email_verification_token: null, email_verification_expires_at: null } as Organization;

    organizationRepository.findOne.mockResolvedValue(existing);
    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce(updated);

    const result = await service.update('org-1', dto as any);

    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', {
      email: 'new@org.com',
      email_verified: false,
      email_verification_token: null,
      email_verification_expires_at: null,
    });
    expect(result).toEqual(updated);
  });

  it('throws NotFoundException when updating missing organization', async () => {
    organizationRepository.findOne.mockResolvedValue(null);

    await expect(service.update('org-1', { email: 'new@org.com' } as any)).rejects.toThrow(NotFoundException);
  });

  it('updates paystack keys and returns updated org', async () => {
    const dto = { paystack_secret_key: 'sk_test', paystack_public_key: 'pk_test' };
    const updated = { id: 'org-1', ...dto } as Organization;

    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValue(updated);

    const result = await service.updatePaystackKeys('org-1', dto as any);

    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual(updated);
  });

  it('uploads a logo and returns updated org', async () => {
    const updated = { id: 'org-1', logo_url: 'https://example.com/logo.png' } as Organization;

    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValue(updated);

    const result = await service.uploadLogo('org-1', 'https://example.com/logo.png');

    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', { logo_url: 'https://example.com/logo.png' });
    expect(result).toEqual(updated);
  });

  it('uploads a supabase logo reference and returns updated org', async () => {
    const updated = { id: 'org-1', logo_url: 'https://supabase.example.com/public/images/logo.png' } as Organization;

    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValue(updated);

    const result = await service.uploadLogo('org-1', 'supabase://images/logo.png');

    expect(storageService.getPublicUrl).toHaveBeenCalledWith('images/logo.png');
    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', { logo_url: 'https://supabase.example.com/public/images/logo.png' });
    expect(result).toEqual(updated);
  });

  it('uploads a logo file to supabase and returns updated org', async () => {
    const updated = { id: 'org-1', logo_url: 'https://supabase.example.com/public/images/logo.png' } as Organization;

    organizationRepository.update.mockResolvedValue(undefined);
    organizationRepository.findOne.mockResolvedValue(updated);

    const result = await service.uploadLogoFromSupabase('org-1', 'images/logo.png', 'dGVzdA==', 'image/png');

    expect(storageService.uploadFile).toHaveBeenCalledWith('images/logo.png', Buffer.from('dGVzdA==', 'base64'), 'image/png');
    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', { logo_url: 'https://supabase.example.com/public/images/logo.png' });
    expect(result).toEqual(updated);
  });

  it('returns organization settings if org exists', async () => {
    const org = {
      id: 'org-1',
      name: 'Org',
      email: 'admin@org.com',
      email_verified: true,
      logo_url: 'https://example.com/logo.png',
      subdomain: 'school',
      custom_domain: 'pay.myuni.com',
      require_contact_login: true,
      notify_submission_confirmation: true,
      notify_payment_confirmation: false,
      notify_payment_failure: false,
    } as Organization;

    organizationRepository.findOne.mockResolvedValue(org);

    const result = await service.getSettings('org-1');

    expect(result).toEqual({
      id: 'org-1',
      name: 'Org',
      email: 'admin@org.com',
      email_verified: true,
      logo_url: 'https://example.com/logo.png',
      subdomain: 'school',
      custom_domain: 'pay.myuni.com',
      require_contact_login: true,
      notify_submission_confirmation: true,
      notify_payment_confirmation: false,
      notify_payment_failure: false,
    });
  });

  it('normalizes and updates tenant domains', async () => {
    const existing = { id: 'org-1', email: 'admin@org.com' } as Organization;
    const updated = {
      id: 'org-1',
      subdomain: 'school',
      custom_domain: 'pay.myuni.com',
    } as Organization;

    organizationRepository.findOne
      .mockResolvedValueOnce(existing)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(updated);
    organizationRepository.update.mockResolvedValue(undefined);

    const result = await service.update('org-1', {
      subdomain: 'School',
      custom_domain: 'https://Pay.MyUni.com/',
    } as any);

    expect(organizationRepository.update).toHaveBeenCalledWith('org-1', {
      subdomain: 'school',
      custom_domain: 'pay.myuni.com',
    });
    expect(result).toEqual(updated);
  });

  it('throws NotFoundException when getting settings for missing org', async () => {
    organizationRepository.findOne.mockResolvedValue(null);

    await expect(service.getSettings('org-1')).rejects.toThrow(NotFoundException);
  });
});
