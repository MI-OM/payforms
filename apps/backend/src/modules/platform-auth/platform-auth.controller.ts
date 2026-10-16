import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Request,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { PlatformAuthService } from './platform-auth.service';
import {
  PlatformLoginDto,
  PlatformRefreshTokenDto,
} from './dto/platform-auth.dto';
import { PlatformJwtAuthGuard } from './guards/platform-jwt-auth.guard';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

const PLATFORM_ACCESS_COOKIE = 'pf_platform_access_token';
const PLATFORM_REFRESH_COOKIE = 'pf_platform_refresh_token';

/**
 * Platform admin authentication. Lives under `/platform/*`, which is unused by
 * the tenant API, and issues cookies with a `pf_platform_` prefix so a browser
 * session on the platform console never collides with a tenant session.
 */
@ApiTags('Platform Admin')
@Controller('platform/auth')
@Throttle({ default: { limit: 30, ttl: 60000 } })
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformAuthController {
  constructor(
    private readonly platformAuthService: PlatformAuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @PlatformAuditAction('PLATFORM ADMIN LOGIN', 'PlatformUser')
  async login(
    @Body() dto: PlatformLoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.platformAuthService.login(dto);
    this.setPlatformCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @PlatformAuditAction('PLATFORM ADMIN TOKEN REFRESH', 'PlatformUser')
  async refresh(
    @Body() dto: PlatformRefreshTokenDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const cookieToken = this.extractCookie(req, PLATFORM_REFRESH_COOKIE);
    const result = await this.platformAuthService.refreshTokens(dto, cookieToken);
    this.setPlatformCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('logout')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  @PlatformAuditAction('PLATFORM ADMIN LOGOUT', 'PlatformUser')
  async logout(@Request() req: any, @Res({ passthrough: true }) res: Response) {
    this.clearPlatformCookies(res);
    return this.platformAuthService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(PlatformJwtAuthGuard)
  @ApiBearerAuth()
  async me(@Request() req: any) {
    return this.platformAuthService.getProfile(req.user.id);
  }

  private setPlatformCookies(res: Response, accessToken: string, refreshToken: string) {
    const options = this.buildCookieOptions();
    res.cookie(PLATFORM_ACCESS_COOKIE, accessToken, {
      ...options,
      maxAge: this.parseDurationMs(
        this.configService.get('PLATFORM_ACCESS_TOKEN_TTL', '15m'),
        15 * 60 * 1000,
      ),
    });
    res.cookie(PLATFORM_REFRESH_COOKIE, refreshToken, {
      ...options,
      maxAge: this.parseDurationMs(
        this.configService.get('PLATFORM_REFRESH_TOKEN_TTL', '7d'),
        7 * 24 * 60 * 60 * 1000,
      ),
    });
  }

  private clearPlatformCookies(res: Response) {
    const options = this.buildCookieOptions();
    res.clearCookie(PLATFORM_ACCESS_COOKIE, options);
    res.clearCookie(PLATFORM_REFRESH_COOKIE, options);
  }

  private buildCookieOptions() {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain =
      this.configService.get<string>('PLATFORM_AUTH_COOKIE_DOMAIN') ||
      this.configService.get<string>('AUTH_COOKIE_DOMAIN') ||
      undefined;

    return {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      domain: cookieDomain,
    };
  }

  private extractCookie(req: any, name: string) {
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

  private parseDurationMs(value: string, fallback: number) {
    const normalized = String(value || '').trim().toLowerCase();
    const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/);
    if (!match) {
      return fallback;
    }

    const amount = Number(match[1]);
    const unit = match[2] || 'ms';
    const multiplier = unit === 'd'
      ? 24 * 60 * 60 * 1000
      : unit === 'h'
        ? 60 * 60 * 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 's'
            ? 1000
            : 1;

    return amount * multiplier;
  }
}
