import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

const mockAuthService = () => ({
  register: jest.fn(),
  login: jest.fn(),
  inviteUser: jest.fn(),
  acceptInvite: jest.fn(),
  refreshTokens: jest.fn(),
  requestPasswordReset: jest.fn(),
  confirmPasswordReset: jest.fn(),
  verifyOrganizationEmail: jest.fn(),
  requestOrganizationEmailVerification: jest.fn(),
  getOrganizationEmailVerificationStatus: jest.fn(),
  logout: jest.fn(),
  getProfile: jest.fn(),
  updateProfile: jest.fn(),
});

describe('AuthController', () => {
  let authController: AuthController;
  let authService: ReturnType<typeof mockAuthService>;

  beforeEach(() => {
    authService = mockAuthService();
    authController = new AuthController(authService as unknown as AuthService);
  });

  it('should register a user', async () => {
    authService.register.mockResolvedValue({ success: true });

    await expect(
      authController.register({ organization_name: 'Acme', email: 'admin@acme.com', password: 'Password123' }),
    ).resolves.toEqual({ success: true });
    expect(authService.register).toHaveBeenCalledWith({
      organization_name: 'Acme',
      email: 'admin@acme.com',
      password: 'Password123',
    });
  });

  it('should login a user', async () => {
    authService.login.mockResolvedValue({ access_token: 'access-token' });

    await expect(
      authController.login({ email: 'admin@acme.com', password: 'Password123' }),
    ).resolves.toEqual({ access_token: 'access-token' });
    expect(authService.login).toHaveBeenCalledWith({
      email: 'admin@acme.com',
      password: 'Password123',
    });
  });

  it('should call inviteUser with request user', async () => {
    authService.inviteUser.mockResolvedValue({ invited: true });

    const req = { user: { id: 'user-admin', organization_id: 'org-1', role: 'ADMIN' } };
    await expect(
      authController.inviteUser(req as any, { first_name: 'Janet', last_name: 'Doe', email: 'new@acme.com' }),
    ).resolves.toEqual({ invited: true });
    expect(authService.inviteUser).toHaveBeenCalledWith(req.user, { first_name: 'Janet', last_name: 'Doe', email: 'new@acme.com' });
  });

  it('should accept invite', async () => {
    authService.acceptInvite.mockResolvedValue({ access_token: 'access-token' });

    await expect(
      authController.acceptInvite({ token: 'invite-token', password: 'Password123' }),
    ).resolves.toEqual({ access_token: 'access-token' });
    expect(authService.acceptInvite).toHaveBeenCalledWith({ token: 'invite-token', password: 'Password123' });
  });

  it('should refresh tokens', async () => {
    authService.refreshTokens.mockResolvedValue({ refresh_token: 'refresh-token' });

    await expect(
      authController.refresh({ refresh_token: 'refresh-token' }),
    ).resolves.toEqual({ refresh_token: 'refresh-token' });
    expect(authService.refreshTokens).toHaveBeenCalledWith({ refresh_token: 'refresh-token' });
  });

  it('should logout a user', async () => {
    authService.logout.mockResolvedValue({ success: true });

    const req = { user: { id: 'user-1' } };
    await expect(authController.logout(req as any)).resolves.toEqual({ success: true });
    expect(authService.logout).toHaveBeenCalledWith('user-1');
  });

  it('should return current user', async () => {
    const req = { user: { id: 'user-1', email: 'admin@acme.com' } };
    authService.getProfile.mockResolvedValue(req.user);
    await expect(authController.getCurrentUser(req as any)).resolves.toEqual(req.user);
    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
  });

  it('should return current profile', async () => {
    const req = { user: { id: 'user-1' } };
    authService.getProfile.mockResolvedValue({ id: 'user-1', first_name: 'Jane' });

    await expect(authController.getProfile(req as any)).resolves.toEqual({ id: 'user-1', first_name: 'Jane' });
    expect(authService.getProfile).toHaveBeenCalledWith('user-1');
  });

  it('should update profile', async () => {
    const req = { user: { id: 'user-1' } };
    authService.updateProfile.mockResolvedValue({ id: 'user-1', first_name: 'Jane', last_name: 'Doe' });

    await expect(
      authController.updateProfile(req as any, { first_name: 'Jane', last_name: 'Doe' }),
    ).resolves.toEqual({ id: 'user-1', first_name: 'Jane', last_name: 'Doe' });
    expect(authService.updateProfile).toHaveBeenCalledWith('user-1', { first_name: 'Jane', last_name: 'Doe' });
  });

  it('should request password reset', async () => {
    authService.requestPasswordReset.mockResolvedValue({ success: true });

    await expect(
      authController.requestPasswordReset({ email: 'admin@acme.com' }),
    ).resolves.toEqual({ success: true });
    expect(authService.requestPasswordReset).toHaveBeenCalledWith({ email: 'admin@acme.com' });
  });

  it('should confirm password reset', async () => {
    authService.confirmPasswordReset.mockResolvedValue({ success: true });

    await expect(
      authController.confirmPasswordReset({ token: 'reset-token', password: 'Password123' }),
    ).resolves.toEqual({ success: true });
    expect(authService.confirmPasswordReset).toHaveBeenCalledWith({
      token: 'reset-token',
      password: 'Password123',
    });
  });

  it('should verify organization email token', async () => {
    authService.verifyOrganizationEmail.mockResolvedValue({ success: true });

    await expect(
      authController.verifyOrganizationEmail({ token: 'verification-token' }),
    ).resolves.toEqual({ success: true });
    expect(authService.verifyOrganizationEmail).toHaveBeenCalledWith({ token: 'verification-token' });
  });
});
