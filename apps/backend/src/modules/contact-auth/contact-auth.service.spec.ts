import * as bcrypt from 'bcrypt';
import { ContactAuthService } from './contact-auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
}));

describe('ContactAuthService', () => {
  let service: ContactAuthService;

  const contactRepository = {
    findOne: jest.fn(),
  };
  const organizationRepository = {
    findOne: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn(),
  };
  const configService = {
    get: jest.fn(),
  };
  const notificationService = {};
  const tenantResolverService = {
    resolveOrganizationFromHost: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactAuthService(
      contactRepository as any,
      organizationRepository as any,
      jwtService as any,
      configService as any,
      notificationService as any,
      tenantResolverService as any,
    );
  });

  it('returns organization branding in login response', async () => {
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1' });
    contactRepository.findOne.mockResolvedValue({
      id: 'contact-1',
      email: 'contact@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      phone: '12345',
      student_id: 'STU-1',
      organization_id: 'org-1',
      is_active: true,
      must_reset_password: false,
      password_hash: 'hashed-password',
      organization: {
        id: 'org-1',
        name: 'Acme School',
        logo_url: 'https://cdn.example.com/logo.png',
        subdomain: 'acme',
        custom_domain: 'portal.acme.test',
      },
    });
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    configService.get.mockReturnValue('8h');
    jwtService.sign.mockReturnValue('contact-token');

    const result = await service.login({
      email: 'contact@example.com',
      password: 'StrongPass123!',
      organization_subdomain: 'acme',
    });

    expect(result).toEqual({
      access_token: 'contact-token',
      organization: {
        id: 'org-1',
        name: 'Acme School',
        logo_url: 'https://cdn.example.com/logo.png',
        subdomain: 'acme',
        custom_domain: 'portal.acme.test',
      },
      contact: {
        id: 'contact-1',
        email: 'contact@example.com',
        first_name: 'Ada',
        last_name: 'Lovelace',
        phone: '12345',
        student_id: 'STU-1',
        organization_id: 'org-1',
        organization: {
          id: 'org-1',
          name: 'Acme School',
          logo_url: 'https://cdn.example.com/logo.png',
          subdomain: 'acme',
          custom_domain: 'portal.acme.test',
        },
        is_active: true,
        must_reset_password: false,
        role: 'CONTACT',
      },
    });
  });
});