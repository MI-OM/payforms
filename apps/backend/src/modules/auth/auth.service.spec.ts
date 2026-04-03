import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';
import { Invitation } from './entities/invitation.entity';
import { Organization } from '../organization/entities/organization.entity';

jest.mock('bcrypt', () => ({
  hash: jest.fn(),
  compare: jest.fn(),
}));

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository<T = any> = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
});

describe('AuthService', () => {
  let authService: AuthService;
  let userRepository: MockRepository;
  let invitationRepository: MockRepository;
  let organizationRepository: MockRepository;
  let jwtService: any;
  let configService: any;
  let notificationService: any;

  beforeEach(() => {
    userRepository = createMockRepository();
    invitationRepository = createMockRepository();
    organizationRepository = createMockRepository();
    jwtService = {
      sign: jest.fn((payload, options) =>
        options?.expiresIn === '7d' ? 'access-token' : 'refresh-token',
      ),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn().mockReturnValue('http://localhost:3000'),
    };
    notificationService = {
      sendOrganizationEmailVerificationEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
      sendEmail: jest.fn().mockResolvedValue(undefined),
    };

    const bcryptMock = bcrypt as any;
    bcryptMock.hash.mockResolvedValue('hashed-value');
    bcryptMock.compare.mockResolvedValue(true);

    authService = new AuthService(
      userRepository as any,
      invitationRepository as any,
      organizationRepository as any,
      jwtService as any,
      configService as any,
      notificationService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('registers a new organization and admin user', async () => {
    const org = { id: 'org-1', name: 'Acme', email: 'admin@acme.com' } as Organization;
    const user = {
      id: 'user-1',
      email: 'admin@acme.com',
      organization_id: 'org-1',
      role: 'ADMIN',
      first_name: null,
      middle_name: null,
      last_name: null,
      title: null,
      designation: null,
      password_hash: 'hashed-value',
    } as User;

    organizationRepository.create.mockReturnValue(org);
    organizationRepository.save.mockResolvedValue(org);
    userRepository.create.mockReturnValue(user);
    userRepository.save.mockResolvedValue(user);
    userRepository.update.mockResolvedValue(undefined);

    const result = await authService.register({
      organization_name: 'Acme',
      email: 'admin@acme.com',
      password: 'Password123',
    });

    expect(organizationRepository.create).toHaveBeenCalledWith({
      name: 'Acme',
      email: 'admin@acme.com',
    });
    expect(userRepository.create).toHaveBeenCalledWith({
      organization_id: 'org-1',
      email: 'admin@acme.com',
      first_name: null,
      middle_name: null,
      last_name: null,
      title: null,
      designation: null,
      password_hash: 'hashed-value',
      role: 'ADMIN',
    });
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-1',
        email: 'admin@acme.com',
        role: 'ADMIN',
        organization_id: 'org-1',
        first_name: null,
        middle_name: null,
        last_name: null,
        title: null,
        designation: null,
      },
    });
    expect(notificationService.sendOrganizationEmailVerificationEmail).toHaveBeenCalled();
  });

  it('throws UnauthorizedException for invalid login email', async () => {
    userRepository.findOne.mockResolvedValue(null);

    await expect(
      authService.login({ email: 'missing@example.com', password: 'password' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('logs in a user with valid credentials', async () => {
    const user = {
      id: 'user-2',
      email: 'staff@acme.com',
      organization_id: 'org-1',
      password_hash: 'hashed-value',
      role: 'STAFF',
      first_name: 'Janet',
      middle_name: null,
      last_name: 'Doe',
      title: 'Mr',
      designation: 'Accountant',
    } as User;

    userRepository.findOne.mockResolvedValue(user);
    userRepository.update.mockResolvedValue(undefined);

    const result = await authService.login({ email: 'staff@acme.com', password: 'Password123' });

    expect(bcrypt.compare).toHaveBeenCalledWith('Password123', 'hashed-value');
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
      user: {
        id: 'user-2',
        email: 'staff@acme.com',
        role: 'STAFF',
        organization_id: 'org-1',
        first_name: 'Janet',
        middle_name: null,
        last_name: 'Doe',
        title: 'Mr',
        designation: 'Accountant',
      },
    });
  });

  it('refreshes tokens when refresh token is valid', async () => {
    const user = {
      id: 'user-3',
      email: 'refresh@acme.com',
      organization_id: 'org-1',
      role: 'STAFF',
      refresh_token_hash: 'hashed-value',
    } as User;

    jwtService.verify.mockReturnValue({ sub: 'user-3' });
    userRepository.findOne.mockResolvedValue(user);
    (bcrypt.compare as any).mockResolvedValue(true);
    userRepository.update.mockResolvedValue(undefined);

    const result = await authService.refreshTokens({ refresh_token: 'refresh-token' });

    expect(jwtService.verify).toHaveBeenCalledWith('refresh-token');
    expect(result).toEqual({
      access_token: 'access-token',
      refresh_token: 'refresh-token',
    });
  });

  it('throws UnauthorizedException for invalid refresh token', async () => {
    jwtService.verify.mockImplementation(() => {
      throw new Error('invalid token');
    });

    await expect(
      authService.refreshTokens({ refresh_token: 'bad-token' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('invites a new staff user successfully', async () => {
    const inviter = {
      id: 'user-admin',
      organization_id: 'org-1',
      role: 'ADMIN',
    } as User;
    const savedInvite = {
      id: 'invite-1',
      email: 'new@acme.com',
      first_name: 'Janet',
      last_name: 'Doe',
      role: 'STAFF',
      token: 'a'.repeat(64),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      created_at: new Date(),
    } as Invitation;

    userRepository.findOne.mockResolvedValue(null);
    invitationRepository.findOne.mockResolvedValue(null);
    invitationRepository.save.mockResolvedValue(savedInvite);
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', name: 'Acme' });

    const result = await authService.inviteUser(inviter, {
      first_name: 'Janet',
      last_name: 'Doe',
      email: 'new@acme.com',
    });

    expect(result).toMatchObject({
      email: 'new@acme.com',
      first_name: 'Janet',
      last_name: 'Doe',
      role: 'STAFF',
    });
    expect(result.token).toHaveLength(64);
    expect(result.invite_email_sent).toBe(true);
    expect(notificationService.sendEmail).toHaveBeenCalledWith(
      ['new@acme.com'],
      'Acme Staff Invitation',
      expect.stringContaining('accept-invite?token='),
    );
  });

  it('still creates invitation when invite email sending fails', async () => {
    const inviter = {
      id: 'user-admin',
      organization_id: 'org-1',
      role: 'ADMIN',
    } as User;
    const savedInvite = {
      id: 'invite-1',
      email: 'new@acme.com',
      first_name: 'Janet',
      last_name: 'Doe',
      role: 'STAFF',
      token: 'a'.repeat(64),
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
      created_at: new Date(),
    } as Invitation;

    userRepository.findOne.mockResolvedValue(null);
    invitationRepository.findOne.mockResolvedValue(null);
    invitationRepository.save.mockResolvedValue(savedInvite);
    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', name: 'Acme' });
    notificationService.sendEmail.mockRejectedValue(new Error('mail failed'));

    const result = await authService.inviteUser(inviter, {
      first_name: 'Janet',
      last_name: 'Doe',
      email: 'new@acme.com',
    });

    expect(result.email).toBe('new@acme.com');
    expect(result.invite_email_sent).toBe(false);
  });

  it('accepts a valid invitation token', async () => {
    const invitation = {
      id: 'invite-2',
      organization_id: 'org-1',
      email: 'invitee@acme.com',
      first_name: 'John',
      last_name: 'Doe',
      role: 'STAFF',
      token: 'token-123',
      accepted: false,
      expires_at: new Date(Date.now() + 1000 * 60 * 60),
    } as Invitation;
    const savedUser = {
      id: 'user-4',
      email: 'invitee@acme.com',
      organization_id: 'org-1',
      role: 'STAFF',
      first_name: 'John',
      middle_name: null,
      last_name: 'Doe',
      title: null,
      designation: null,
      password_hash: 'hashed-value',
    } as User;

    invitationRepository.findOne.mockResolvedValue(invitation);
    userRepository.findOne.mockResolvedValue(null);
    userRepository.save.mockResolvedValue(savedUser);
    invitationRepository.save.mockResolvedValue(invitation);
    userRepository.update.mockResolvedValue(undefined);

    const result = await authService.acceptInvite({ token: 'token-123', password: 'Password123' });

    expect(result.user.email).toBe('invitee@acme.com');
    expect(result.access_token).toBe('access-token');
    expect(result.refresh_token).toBe('refresh-token');
  });

  it('throws BadRequestException for expired invite token', async () => {
    invitationRepository.findOne.mockResolvedValue({
      token: 'token-expired',
      accepted: false,
      expires_at: new Date(Date.now() - 1000 * 60),
    } as Invitation);

    await expect(
      authService.acceptInvite({ token: 'token-expired', password: 'Password123' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('requests password reset for a user', async () => {
    const user = {
      id: 'user-reset',
      email: 'reset@acme.com',
      organization_id: 'org-1',
      password_hash: 'hashed-value',
      role: 'STAFF',
      password_reset_token: null,
      password_reset_expires_at: null,
    } as User;
    const org = { id: 'org-1', name: 'Acme', email: 'reset@acme.com' } as Organization;

    userRepository.findOne.mockResolvedValue(user);
    userRepository.save.mockResolvedValue(user);
    organizationRepository.findOne.mockResolvedValue(org);

    const result = await authService.requestPasswordReset({ email: 'reset@acme.com' });

    expect(result).toEqual({ success: true });
    expect(notificationService.sendPasswordResetEmail).toHaveBeenCalled();
  });

  it('confirms password reset with a valid token', async () => {
    const user = {
      id: 'user-reset',
      email: 'reset@acme.com',
      organization_id: 'org-1',
      password_hash: 'old-hash',
      role: 'STAFF',
      password_reset_token: 'token-1',
      password_reset_expires_at: new Date(Date.now() + 1000 * 60),
      refresh_token_hash: 'refresh-hash',
    } as User;

    userRepository.findOne.mockResolvedValue(user);
    userRepository.save.mockResolvedValue(user);

    const result = await authService.confirmPasswordReset({
      token: 'token-1',
      password: 'NewPassword123',
    });

    expect(result).toEqual({ success: true });
    expect(userRepository.save).toHaveBeenCalled();
  });

  it('gets profile for an existing user', async () => {
    const user = {
      id: 'user-profile',
      email: 'profile@acme.com',
      organization_id: 'org-1',
      role: 'STAFF',
      first_name: 'Jane',
      middle_name: 'M',
      last_name: 'Doe',
      title: 'Ms',
      designation: 'Officer',
    } as User;

    userRepository.findOne.mockResolvedValue(user);

    const result = await authService.getProfile('user-profile');
    expect(result).toEqual({
      id: 'user-profile',
      email: 'profile@acme.com',
      role: 'STAFF',
      organization_id: 'org-1',
      first_name: 'Jane',
      middle_name: 'M',
      last_name: 'Doe',
      title: 'Ms',
      designation: 'Officer',
    });
  });

  it('updates profile fields and normalizes empty strings to null', async () => {
    const user = {
      id: 'user-profile',
      email: 'profile@acme.com',
      organization_id: 'org-1',
      role: 'STAFF',
      first_name: 'Jane',
      middle_name: 'M',
      last_name: 'Doe',
      title: 'Ms',
      designation: 'Officer',
    } as User;

    userRepository.findOne.mockResolvedValueOnce(user);
    userRepository.update.mockResolvedValue(undefined);
    userRepository.findOne.mockResolvedValueOnce({
      ...user,
      first_name: 'Janet',
      middle_name: null,
      last_name: 'Doe',
      title: null,
      designation: 'Lead Officer',
    } as User);

    const result = await authService.updateProfile('user-profile', {
      first_name: ' Janet ',
      middle_name: '   ',
      title: '',
      designation: 'Lead Officer',
    });

    expect(userRepository.update).toHaveBeenCalledWith('user-profile', {
      first_name: 'Janet',
      middle_name: null,
      title: null,
      designation: 'Lead Officer',
    });
    expect(result).toEqual({
      id: 'user-profile',
      email: 'profile@acme.com',
      role: 'STAFF',
      organization_id: 'org-1',
      first_name: 'Janet',
      middle_name: null,
      last_name: 'Doe',
      title: null,
      designation: 'Lead Officer',
    });
  });

  it('verifies organization email with a valid token', async () => {
    const org = {
      id: 'org-verify',
      name: 'Acme',
      email: 'admin@acme.com',
      email_verified: false,
      email_verification_token: 'verify-token',
      email_verification_expires_at: new Date(Date.now() + 1000 * 60),
    } as Organization;

    organizationRepository.findOne.mockResolvedValue(org);
    organizationRepository.save.mockResolvedValue(org);

    const result = await authService.verifyOrganizationEmail({ token: 'verify-token' });

    expect(result).toEqual({
      success: true,
      organization_id: 'org-verify',
      email_verified: true,
    });
  });
});
