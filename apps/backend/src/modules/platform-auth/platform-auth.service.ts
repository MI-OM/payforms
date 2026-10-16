import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { PlatformUser } from './entities/platform-user.entity';
import { PlatformLoginDto, PlatformRefreshTokenDto } from './dto/platform-auth.dto';

/**
 * Authentication for platform operators. Self-contained: it never touches the
 * tenant `users` table or the tenant JWT configuration.
 */
@Injectable()
export class PlatformAuthService {
  constructor(
    @InjectRepository(PlatformUser)
    private readonly platformUserRepository: Repository<PlatformUser>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async login(dto: PlatformLoginDto) {
    const email = this.normalizeEmail(dto.email);
    const user = await this.platformUserRepository.findOne({ where: { email } });

    if (!user || !user.is_active) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.platformUserRepository.update(user.id, { last_login_at: new Date() });

    const tokens = await this.createTokens(user);
    return {
      ...tokens,
      user: this.mapPlatformUser(user),
    };
  }

  async refreshTokens(dto: PlatformRefreshTokenDto, cookieToken?: string | null) {
    const refreshToken = dto.refresh_token || cookieToken;
    if (!refreshToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload?.typ !== 'refresh') {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.platformUserRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.is_active || !user.refresh_token_hash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokens = await this.createTokens(user);
    return {
      ...tokens,
      user: this.mapPlatformUser(user),
    };
  }

  async logout(userId: string) {
    await this.platformUserRepository.update(userId, { refresh_token_hash: null });
    return { success: true };
  }

  async getProfile(userId: string) {
    const user = await this.platformUserRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.mapPlatformUser(user);
  }

  /** Used by `PlatformJwtStrategy` to re-validate the token subject on each request. */
  async validatePlatformUser(id: string): Promise<PlatformUser | null> {
    if (!id) {
      return null;
    }
    return this.platformUserRepository.findOne({ where: { id } });
  }

  private async createTokens(user: PlatformUser) {
    const payload = {
      sub: user.id,
      email: user.email,
      platform_role: user.role,
    };

    // `jti` guarantees every issued token is unique. Without it, two tokens
    // signed in the same second for the same subject are byte-identical
    // (identical `iat`/`exp`), which would make refresh-token rotation a no-op
    // for rapid successive refreshes.
    const access_token = this.jwtService.sign(
      { ...payload, typ: 'access', jti: randomUUID() },
      { expiresIn: this.configService.get('PLATFORM_ACCESS_TOKEN_TTL', '15m') },
    );

    const refresh_token = this.jwtService.sign(
      { ...payload, typ: 'refresh', jti: randomUUID() },
      { expiresIn: this.configService.get('PLATFORM_REFRESH_TOKEN_TTL', '7d') },
    );

    await this.platformUserRepository.update(user.id, {
      refresh_token_hash: await bcrypt.hash(refresh_token, 10),
    });

    return {
      access_token,
      refresh_token,
      expires_in: this.configService.get('PLATFORM_ACCESS_TOKEN_TTL', '15m'),
    };
  }

  private mapPlatformUser(user: PlatformUser) {
    return {
      id: user.id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
      is_active: user.is_active,
      last_login_at: user.last_login_at,
      created_at: user.created_at,
    };
  }

  private normalizeEmail(email: string) {
    return String(email || '').trim().toLowerCase();
  }
}
