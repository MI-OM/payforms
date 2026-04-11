import { UnauthorizedException } from '@nestjs/common';
import { ContactJwtStrategy } from './contact-jwt.strategy';

describe('ContactJwtStrategy', () => {
  const configService = {
    get: jest.fn().mockReturnValue('test-secret'),
  };
  const contactAuthService = {
    validateContact: jest.fn(),
    getOrganizationBranding: jest.fn(),
  };

  let strategy: ContactJwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    strategy = new ContactJwtStrategy(configService as any, contactAuthService as any);
  });

  it('rejects unknown contact', async () => {
    contactAuthService.validateContact.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'contact-1', organization_id: 'org-1', role: 'CONTACT' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects inactive contact', async () => {
    contactAuthService.validateContact.mockResolvedValue({
      id: 'contact-1',
      organization_id: 'org-1',
      is_active: false,
    });

    await expect(
      strategy.validate({ sub: 'contact-1', organization_id: 'org-1', role: 'CONTACT' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects token issued before invalidation time', async () => {
    contactAuthService.validateContact.mockResolvedValue({
      id: 'contact-1',
      email: 'contact@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      is_active: true,
      student_id: null,
      phone: null,
      organization_id: 'org-1',
      token_invalidated_at: new Date('2026-01-01T00:00:10.000Z'),
    });

    await expect(
      strategy.validate({
        sub: 'contact-1',
        organization_id: 'org-1',
        role: 'CONTACT',
        iat: Math.floor(new Date('2026-01-01T00:00:00.000Z').getTime() / 1000),
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts valid active contact and returns auth payload', async () => {
    contactAuthService.validateContact.mockResolvedValue({
      id: 'contact-1',
      email: 'contact@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      is_active: true,
      student_id: 'STU-1',
      phone: '12345',
      organization_id: 'org-1',
      token_invalidated_at: null,
    });
    contactAuthService.getOrganizationBranding.mockResolvedValue({
      id: 'org-1',
      name: 'Acme School',
      logo_url: 'https://cdn.example.com/logo.png',
      subdomain: 'acme',
      custom_domain: null,
    });

    const result = await strategy.validate({
      sub: 'contact-1',
      organization_id: 'org-1',
      role: 'CONTACT',
      iat: Math.floor(new Date('2026-01-01T00:00:20.000Z').getTime() / 1000),
    });

    expect(result).toEqual({
      id: 'contact-1',
      email: 'contact@example.com',
      first_name: 'Ada',
      last_name: 'Lovelace',
      is_active: true,
      student_id: 'STU-1',
      phone: '12345',
      organization_id: 'org-1',
      organization: {
        id: 'org-1',
        name: 'Acme School',
        logo_url: 'https://cdn.example.com/logo.png',
        subdomain: 'acme',
        custom_domain: null,
      },
      role: 'CONTACT',
    });
  });
});
