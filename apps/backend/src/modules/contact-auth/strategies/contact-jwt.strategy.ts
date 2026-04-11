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

    if (!contact || !contact.is_active) {
      throw new UnauthorizedException('Invalid contact credentials');
    }

    const tokenIssuedAt = typeof payload?.iat === 'number'
      ? new Date(payload.iat * 1000)
      : null;

    if (
      tokenIssuedAt &&
      contact.token_invalidated_at &&
      contact.token_invalidated_at > tokenIssuedAt
    ) {
      throw new UnauthorizedException('Contact token has been invalidated');
    }

    const organization = await this.contactAuthService.getOrganizationBranding(contact.organization_id);

    return {
      id: contact.id,
      email: contact.email,
      first_name: contact.first_name,
      last_name: contact.last_name,
      is_active: contact.is_active,
      student_id: contact.student_id,
      phone: contact.phone,
      organization_id: contact.organization_id,
      organization,
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
