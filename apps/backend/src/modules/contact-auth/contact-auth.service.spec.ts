import * as bcrypt from 'bcrypt';
import { ContactAuthService } from './contact-auth.service';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';


declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  findOne: jest.fn(),
  save: jest.fn(),
});

describe('ContactAuthService', () => {
  let service: ContactAuthService;
  let contactRepository: MockRepository;
  let organizationRepository: MockRepository;
  let jwtService: any;
  let configService: any;
  let notificationService: any;

  beforeEach(() => {
    contactRepository = createMockRepository();
    organizationRepository = createMockRepository();
    jwtService = { sign: jest.fn().mockReturnValue('jwt-token') };
    configService = { get: jest.fn().mockReturnValue('http://localhost:3000') };
    notificationService = { sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined) };

    service = new ContactAuthService(
      contactRepository as any,
      organizationRepository as any,
      jwtService as any,
      configService as any,
      notificationService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('logs in an active contact and returns tokens', async () => {
    const hashedPassword = await bcrypt.hash('pass1234', 10);
    const contact = {
      id: 'contact-1',
      email: 'contact@example.com',
      password_hash: hashedPassword,
      organization_id: 'org-1',
      is_active: true,
      must_reset_password: false,
      organization: { id: 'org-1', name: 'Org' } as Organization,
    } as unknown as Contact;

    contactRepository.findOne.mockResolvedValue(contact);

    const result = await service.login({ email: 'contact@example.com', password: 'pass1234', organization_id: 'org-1' } as any);

    expect(result.access_token).toBe('jwt-token');
    expect(result.contact).toEqual({
      id: 'contact-1',
      email: 'contact@example.com',
      organization_id: 'org-1',
      is_active: true,
      must_reset_password: false,
    });
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: 'contact-1',
      email: 'contact@example.com',
      organization_id: 'org-1',
      role: 'CONTACT',
    });
  });

  it('logs in using organization subdomain context', async () => {
    const hashedPassword = await bcrypt.hash('pass1234', 10);
    const contact = {
      id: 'contact-2',
      email: 'student@example.com',
      password_hash: hashedPassword,
      organization_id: 'org-tenant',
      is_active: true,
      must_reset_password: false,
      organization: { id: 'org-tenant', name: 'Tenant Org' } as Organization,
    } as unknown as Contact;

    organizationRepository.findOne.mockResolvedValueOnce({ id: 'org-tenant' });
    contactRepository.findOne.mockResolvedValue(contact);

    await service.login({
      email: 'student@example.com',
      password: 'pass1234',
      organization_subdomain: 'school',
    } as any);

    expect(organizationRepository.findOne).toHaveBeenCalledWith({
      where: { subdomain: 'school' },
      select: ['id'],
    });
    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { email: 'student@example.com', organization_id: 'org-tenant' },
      relations: ['organization'],
    });
  });

  it('validates a contact by id and organization', async () => {
    const contact = { id: 'contact-1' } as unknown as Contact;
    contactRepository.findOne.mockResolvedValue(contact);

    const result = await service.validateContact('contact-1', 'org-1');

    expect(contactRepository.findOne).toHaveBeenCalledWith({ where: { id: 'contact-1', organization_id: 'org-1' } });
    expect(result).toEqual(contact);
  });

  it('sets a new password for a contact and saves it', async () => {
    const contact = {
      id: 'contact-1',
      password_reset_token: 'reset-token',
      password_reset_expires_at: new Date(Date.now() + 1000 * 60 * 60),
      must_reset_password: true,
      is_active: false,
    } as unknown as Contact;

    contactRepository.findOne.mockResolvedValue(contact);
    contactRepository.save.mockImplementation(async updatedContact => updatedContact);

    const result = await service.setPassword({ token: 'reset-token', password: 'NewPassword123!' } as any);

    expect(contactRepository.findOne).toHaveBeenCalledWith({ where: { password_reset_token: 'reset-token' } });
    expect(result.password_hash).toBeDefined();
    expect(result.is_active).toBe(true);
    expect(result.must_reset_password).toBe(false);
  });

  it('requests a password reset and sends an email with a token', async () => {
    const contact = {
      id: 'contact-1',
      email: 'contact@example.com',
      organization_id: 'org-1',
      organization: null,
    } as unknown as Contact;
    const organization = { id: 'org-1', name: 'Org' } as Organization;

    contactRepository.findOne.mockResolvedValue(contact);
    organizationRepository.findOne.mockResolvedValue(organization);
    contactRepository.save.mockImplementation(async updatedContact => updatedContact as any);

    const result = await service.requestPasswordReset({ email: 'contact@example.com', organization_id: 'org-1' } as any);

    expect(result).toEqual({ success: true });
    expect(contactRepository.save).toHaveBeenCalled();
    expect(notificationService.sendPasswordResetEmail).toHaveBeenCalledWith(
      organization,
      'contact@example.com',
      expect.stringContaining('http://localhost:3000/contact-reset?token='),
    );
  });

  it('uses request host custom domain context for password reset', async () => {
    const contact = {
      id: 'contact-3',
      email: 'domain-user@example.com',
      organization_id: 'org-domain',
      organization: null,
    } as unknown as Contact;
    const organization = { id: 'org-domain', name: 'Domain Org' } as Organization;

    organizationRepository.findOne
      .mockResolvedValueOnce({ id: 'org-domain' })
      .mockResolvedValueOnce(organization);
    contactRepository.findOne.mockResolvedValue(contact);
    contactRepository.save.mockImplementation(async updatedContact => updatedContact as any);

    const result = await service.requestPasswordReset(
      { email: 'domain-user@example.com' } as any,
      'pay.myuni.com',
    );

    expect(result).toEqual({ success: true });
    expect(organizationRepository.findOne).toHaveBeenNthCalledWith(1, {
      where: { custom_domain: 'pay.myuni.com' },
      select: ['id'],
    });
  });

  it('throws when no organization context is provided', async () => {
    await expect(
      service.login({ email: 'student@example.com', password: 'pass1234' } as any),
    ).rejects.toThrow('Organization context is required');
  });

  it('confirms a password reset and updates the contact password', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);
    const contact = {
      id: 'contact-1',
      password_reset_token: 'reset-token',
      password_reset_expires_at: futureDate,
      must_reset_password: true,
      is_active: false,
    } as unknown as Contact;

    contactRepository.findOne.mockResolvedValue(contact);
    contactRepository.save.mockImplementation(async updatedContact => updatedContact as any);

    const result = await service.confirmPasswordReset({ token: 'reset-token', password: 'NewPassword123!' } as any);

    expect(contactRepository.findOne).toHaveBeenCalledWith({ where: { password_reset_token: 'reset-token' } });
    expect(result.password_hash).toBeDefined();
    expect(result.is_active).toBe(true);
    expect(result.must_reset_password).toBe(false);
    expect(result.password_reset_token).toBeNull();
    expect(result.password_reset_expires_at).toBeNull();
  });

  it('throws BadRequestException for weak contact password reset passwords', async () => {
    const futureDate = new Date(Date.now() + 1000 * 60 * 60);
    const contact = {
      id: 'contact-1',
      password_reset_token: 'reset-token',
      password_reset_expires_at: futureDate,
      must_reset_password: true,
      is_active: false,
    } as unknown as Contact;

    contactRepository.findOne.mockResolvedValue(contact);

    await expect(
      service.confirmPasswordReset({ token: 'reset-token', password: 'weakpass' } as any),
    ).rejects.toThrow('Password must be at least 12 characters long');
  });
});
