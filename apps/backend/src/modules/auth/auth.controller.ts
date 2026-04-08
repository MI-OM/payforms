import { Controller, Post, Body, Get, Patch, UseGuards, Request, Res, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, InviteUserDto, AcceptInviteDto, UpdateProfileDto, PasswordResetRequestDto, PasswordResetConfirmDto, VerifyOrganizationEmailDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@ApiTags('Auth')
@Controller('auth')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
  ) {}

  @Post('register')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register(dto);
    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto, this.resolveRequestHost(req));
    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async inviteUser(@Request() req, @Body() dto: InviteUserDto) {
    return this.authService.inviteUser(req.user, dto);
  }

  @Post('accept-invite')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  @Post('refresh')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  async refresh(@Body() dto: RefreshTokenDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const refreshToken = dto.refresh_token || this.extractCookie(req, 'pf_refresh_token');
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const result = await this.authService.refreshTokens({ refresh_token: refreshToken });
    this.setAuthCookies(res, result.access_token, result.refresh_token);
    return result;
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Post('organization-email/verify')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async verifyOrganizationEmail(@Body() dto: VerifyOrganizationEmailDto) {
    return this.authService.verifyOrganizationEmail(dto);
  }

  @Post('organization-email/request-verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async requestOrganizationEmailVerification(@Request() req) {
    return this.authService.requestOrganizationEmailVerification(req.user);
  }

  @Get('organization-email/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getOrganizationEmailVerificationStatus(@Request() req) {
    return this.authService.getOrganizationEmailVerificationStatus(req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Request() req, @Res({ passthrough: true }) res: Response) {
    this.clearAuthCookies(res);
    return this.authService.logout(req.user.id);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateProfile(@Request() req, @Body() dto: UpdateProfileDto) {
    return this.authService.updateProfile(req.user.id, dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentUser(@Request() req) {
    return this.authService.getProfile(req.user.id);
  }

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const options = this.buildCookieOptions();
    res.cookie('pf_access_token', accessToken, {
      ...options,
      maxAge: this.parseDurationMs(this.configService.get('AUTH_ACCESS_TOKEN_TTL', '15m'), 15 * 60 * 1000),
    });
    res.cookie('pf_refresh_token', refreshToken, {
      ...options,
      maxAge: this.parseDurationMs(this.configService.get('AUTH_REFRESH_TOKEN_TTL', '30d'), 30 * 24 * 60 * 60 * 1000),
    });
  }

  private clearAuthCookies(res: Response) {
    const options = this.buildCookieOptions();
    res.clearCookie('pf_access_token', options);
    res.clearCookie('pf_refresh_token', options);
  }

  private buildCookieOptions() {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN') || undefined;

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

    const cookies = String(header).split(';');
    for (const cookie of cookies) {
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

  private resolveRequestHost(req: any): string | null {
    const originHost = this.extractHostFromUrl(req?.headers?.origin || req?.headers?.referer);
    if (originHost) {
      return originHost;
    }

    const header =
      req?.headers?.['x-forwarded-host'] ||
      req?.headers?.host ||
      (typeof req?.get === 'function' ? req.get('host') : null);

    if (!header) {
      return null;
    }

    const firstValue = String(Array.isArray(header) ? header[0] : header)
      .split(',')[0]
      .trim();

    return firstValue || null;
  }

  private extractHostFromUrl(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
      return null;
    }

    try {
      return new URL(raw).host;
    } catch {
      return null;
    }
  }
}
