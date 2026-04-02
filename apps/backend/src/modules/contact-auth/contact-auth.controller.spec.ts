import { ContactAuthController } from './contact-auth.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockContactAuthService = ReturnType<typeof mockContactAuthService>;

const mockContactAuthService = () => ({
  login: jest.fn(),
  setPassword: jest.fn(),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
});

describe('ContactAuthController', () => {
  let controller: ContactAuthController;
  let service: MockContactAuthService;

  beforeEach(() => {
    service = mockContactAuthService();
    controller = new ContactAuthController(service as any);
  });

  it('logs in a contact', async () => {
    const dto = { email: 'contact@example.com', password: 'pass1234', organization_id: 'org-1' };
    service.login.mockResolvedValue({ access_token: 'token' });

    const result = await controller.login(dto as any);

    expect(service.login).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ access_token: 'token' });
  });

  it('sets a contact password', async () => {
    const dto = { token: 'reset-token', password: 'NewPass123' };
    service.setPassword.mockResolvedValue({ id: 'contact-1' });

    const result = await controller.setPassword(dto as any);

    expect(service.setPassword).toHaveBeenCalledWith(dto);
    expect(result).toEqual({ id: 'contact-1' });
  });

  it('requests password reset using both endpoints', async () => {
    const dto = { email: 'contact@example.com' };
    service.requestPasswordReset.mockResolvedValue({ success: true });

    const result1 = await controller.requestPasswordReset(dto as any);
    const result2 = await controller.requestPasswordResetAlias(dto as any);

    expect(service.requestPasswordReset).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ success: true });
    expect(result2).toEqual({ success: true });
  });

  it('confirms password reset using both endpoints', async () => {
    const dto = { token: 'reset-token', password: 'NewPass123' };
    service.confirmPasswordReset.mockResolvedValue({ id: 'contact-1' });

    const result1 = await controller.confirmPasswordReset(dto as any);
    const result2 = await controller.confirmPasswordResetAlias(dto as any);

    expect(service.confirmPasswordReset).toHaveBeenCalledTimes(2);
    expect(result1).toEqual({ id: 'contact-1' });
    expect(result2).toEqual({ id: 'contact-1' });
  });

  it('returns the current contact user', async () => {
    const req = { user: { id: 'contact-1' } };

    const result = await controller.getCurrentContact(req as any);

    expect(result).toEqual({ id: 'contact-1' });
  });
});
