import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Resolves the secret used to sign/verify *platform admin* tokens.
 *
 * Platform tokens MUST NOT share a secret with tenant tokens, otherwise a
 * tenant user's token could be replayed against the platform API (and vice
 * versa). We therefore prefer a dedicated `PLATFORM_JWT_SECRET`.
 *
 * When it is not set (e.g. a developer's local `.env`), we derive a distinct
 * secret from `JWT_SECRET` so the app still boots without a config change —
 * but we warn loudly, because production must set `PLATFORM_JWT_SECRET`.
 * The derived value still differs from the tenant secret, so tokens remain
 * non-interchangeable either way.
 */
export function resolvePlatformJwtSecret(configService: ConfigService): string {
  const explicit = configService.get<string>('PLATFORM_JWT_SECRET');
  if (explicit && explicit.trim()) {
    return explicit.trim();
  }

  const fallback = configService.get<string>('JWT_SECRET');
  if (!fallback || !fallback.trim()) {
    throw new Error(
      'Neither PLATFORM_JWT_SECRET nor JWT_SECRET is configured. Set PLATFORM_JWT_SECRET in the environment.',
    );
  }

  Logger.warn(
    'PLATFORM_JWT_SECRET is not set; deriving the platform admin token secret from JWT_SECRET. Set PLATFORM_JWT_SECRET before deploying.',
    'PlatformJwtConfig',
  );

  return `${fallback.trim()}::platform-admin`;
}
