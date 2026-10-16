import { UnauthorizedException } from '@nestjs/common';
import { PlatformJwtStrategy } from './platform-jwt.strategy';

describe('PlatformJwtStrategy', () => {
  const configService = { get: jest.fn() };
  const platformAuthService = { validatePlatformUser: jest.fn() };

  let strategy: PlatformJwtStrategy;

  beforeEach(() => {
    jest.clearAllMocks();
    configService.get.mockReturnValue('platform-test-secret');
    strategy = new PlatformJwtStrategy(
      configService as any,
      platformAuthService as any,
    );
  });

  it('rejects a token without the access marker', async () => {
    await expect(
      strategy.validate({ sub: 'platform-1', typ: 'refresh' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an unknown platform user', async () => {
    platformAuthService.validatePlatformUser.mockResolvedValue(null);

    await expect(
      strategy.validate({ sub: 'platform-1', typ: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects an inactive platform user', async () => {
    platformAuthService.validatePlatformUser.mockResolvedValue({
      id: 'platform-1',
      email: 'admin@payforms.com.ng',
      role: 'SUPER',
      is_active: false,
    });

    await expect(
      strategy.validate({ sub: 'platform-1', typ: 'access' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('returns the platform principal for a valid admin', async () => {
    platformAuthService.validatePlatformUser.mockResolvedValue({
      id: 'platform-1',
      email: 'admin@payforms.com.ng',
      role: 'SUPER',
      is_active: true,
    });

    const result = await strategy.validate({ sub: 'platform-1', typ: 'access' });

    expect(result).toEqual({
      id: 'platform-1',
      email: 'admin@payforms.com.ng',
      role: 'SUPER',
      is_platform_admin: true,
    });
  });
});
