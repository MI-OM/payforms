import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { ContactAuthService } from '../contact-auth.service';

@Injectable()
export class ContactJwtStrategy extends PassportStrategy(Strategy, 'contact-jwt') {
  constructor(
    configService: ConfigService,
    private contactAuthService: ContactAuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (req: any) => this.extractCookie(req, 'pf_contact_token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    const contact = await this.contactAuthService.validateContact(
      payload.sub,
      payload.organization_id,
    );

    if (!contact) {
      throw new UnauthorizedException('Invalid contact credentials');
    }

    return {
      id: payload.sub,
      email: payload.email,
      organization_id: payload.organization_id,
      role: payload.role,
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
