import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => this.extractCookie(req, 'pf_access_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const user = await this.authService.validateUser(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return {
      id: user.id,
      email: user.email,
      organization_id: user.organization_id,
      role: user.role,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      title: user.title,
      designation: user.designation,
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
}
