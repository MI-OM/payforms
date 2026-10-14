import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PlatformAuthService } from './platform-auth.service';

describe('PlatformAuthService', () => {
  const password = 'StrongPass123!';
  let passwordHash: string;
  let repository: { findOne: jest.Mock; update: jest.Mock };
  let jwtService: { sign: jest.Mock; verify: jest.Mock };
  let configService: { get: jest.Mock };
  let service: PlatformAuthService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(password, 4);
  });

  const activeUser = () => ({
    id: 'platform-1',
    email: 'admin@payforms.com.ng',
    password_hash: passwordHash,
    role: 'SUPER',
    first_name: 'Platform',
    last_name: 'Admin',
    is_active: true,
    last_login_at: null,
    refresh_token_hash: null,
    created_at: new Date('2026-01-01T00:00:00.000Z'),
  });

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('signed-token'),
      verify: jest.fn(),
    };
    configService = {
      get: jest.fn((_key: string, fallback?: unknown) => fallback),
    };
    service = new PlatformAuthService(
      repository as any,
      jwtService as any,
      configService as any,
    );
  });

  it('issues tokens and normalizes the email on valid login', async () => {
    repository.findOne.mockResolvedValue(activeUser());

    const result = await service.login({
      email: 'Admin@Payforms.com.ng',
      password,
    });

    expect(repository.findOne).toHaveBeenCalledWith({
      where: { email: 'admin@payforms.com.ng' },
    });
    expect(result.access_token).toBe('signed-token');
    expect(result.refresh_token).toBe('signed-token');
    expect(result.user).not.toHaveProperty('password_hash');
    expect(repository.update).toHaveBeenCalledWith(
      'platform-1',
      expect.objectContaining({ last_login_at: expect.any(Date) }),
    );
  });

  it('rejects an unknown email', async () => {
    repository.findOne.mockResolvedValue(null);

    await expect(
      service.login({ email: 'nobody@payforms.com.ng', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive account', async () => {
    repository.findOne.mockResolvedValue({ ...activeUser(), is_active: false });

    await expect(
      service.login({ email: 'admin@payforms.com.ng', password }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects a wrong password', async () => {
    repository.findOne.mockResolvedValue(activeUser());

    await expect(
      service.login({ email: 'admin@payforms.com.ng', password: 'WrongPass123!' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh when the token is not a refresh token', async () => {
    jwtService.verify.mockReturnValue({ sub: 'platform-1', typ: 'access' });

    await expect(
      service.refreshTokens({ refresh_token: 'access-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects refresh when the stored hash does not match', async () => {
    jwtService.verify.mockReturnValue({ sub: 'platform-1', typ: 'refresh' });
    repository.findOne.mockResolvedValue({
      ...activeUser(),
      refresh_token_hash: await bcrypt.hash('a-different-token', 4),
    });

    await expect(
      service.refreshTokens({ refresh_token: 'valid-refresh-token' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rotates tokens on a valid refresh token', async () => {
    const refreshToken = 'valid-refresh-token';
    jwtService.verify.mockReturnValue({ sub: 'platform-1', typ: 'refresh' });
    repository.findOne.mockResolvedValue({
      ...activeUser(),
      refresh_token_hash: await bcrypt.hash(refreshToken, 4),
    });

    const result = await service.refreshTokens({ refresh_token: refreshToken });

    expect(result.access_token).toBe('signed-token');
    expect(repository.update).toHaveBeenCalledWith(
      'platform-1',
      expect.objectContaining({ refresh_token_hash: expect.any(String) }),
    );
  });

  it('logs out by clearing the stored refresh token hash', async () => {
    const result = await service.logout('platform-1');

    expect(result).toEqual({ success: true });
    expect(repository.update).toHaveBeenCalledWith('platform-1', {
      refresh_token_hash: null,
    });
  });
});
