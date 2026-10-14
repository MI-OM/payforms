import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PlatformAuthService } from '../platform-auth.service';
import { resolvePlatformJwtSecret } from '../platform-jwt.config';

/**
 * Platform admin JWT strategy.
 *
 * Registered under the name `platform-jwt` (tenant auth is `jwt`) and signed
 * with a distinct secret, so the two token families cannot be interchanged.
 * Accepts either an `Authorization: Bearer` header or the
 * `pf_platform_access_token` cookie.
 */
@Injectable()
export class PlatformJwtStrategy extends PassportStrategy(Strategy, 'platform-jwt') {
  constructor(
    configService: ConfigService,
    private readonly platformAuthService: PlatformAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => this.extractCookie(req, 'pf_platform_access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: resolvePlatformJwtSecret(configService),
    });
  }

  async validate(payload: any) {
    // Reject refresh tokens (and anything without an explicit access marker) so
    // a long-lived refresh token can't be used as an access token.
    if (!payload || payload.typ !== 'access') {
      throw new UnauthorizedException('Invalid credentials');
    }

    const user = await this.platformAuthService.validatePlatformUser(payload.sub);
    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      is_platform_admin: true,
    };
  }

  private extractCookie(req: any, name: string): string | null {
    const header = req?.headers?.cookie;
    if (!header) {
      return null;
    }

    for (const cookie of String(header).split(';')) {
      const [key, ...valueParts] = cookie.trim().split('=');
      if (key === name) {
        return decodeURIComponent(valueParts.join('='));
      }
    }

    return null;
  }
}
