import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';
import { NotificationService } from '../notification/notification.service';
import { ConfigService } from '@nestjs/config';
import {
  ContactLoginDto,
  ContactSetPasswordDto,
  ContactPasswordResetRequestDto,
  ContactResetPasswordDto,
} from './dto/contact-auth.dto';

@Injectable()
export class ContactAuthService {
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async login(dto: ContactLoginDto) {
    const contact = await this.contactRepository.findOne({
      where: { email: dto.email, organization_id: dto.organization_id },
      relations: ['organization'],
    });

    if (!contact || !contact.is_active || !contact.password_hash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(dto.password, contact.password_hash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const org = contact.organization;
    if (!org) {
      throw new UnauthorizedException('Invalid contact organization');
    }

    const accessToken = this.jwtService.sign({
      sub: contact.id,
      email: contact.email,
      organization_id: contact.organization_id,
      role: 'CONTACT',
    });

    return {
      access_token: accessToken,
      contact: {
        id: contact.id,
        email: contact.email,
        organization_id: contact.organization_id,
        is_active: contact.is_active,
        must_reset_password: contact.must_reset_password,
      },
    };
  }

  async validateContact(id: string, organizationId: string): Promise<Contact | null> {
    return this.contactRepository.findOne({ where: { id, organization_id: organizationId } });
  }

  async setPassword(dto: ContactSetPasswordDto) {
    return this.confirmPasswordReset(dto as ContactResetPasswordDto);
  }

  async requestPasswordReset(dto: ContactPasswordResetRequestDto) {
    const contact = await this.contactRepository.findOne({
      where: { email: dto.email, organization_id: dto.organization_id },
      relations: ['organization'],
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60);

    contact.password_reset_token = token;
    contact.password_reset_expires_at = expiresAt;
    contact.must_reset_password = true;
    await this.contactRepository.save(contact);

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetLink = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/contact-reset?token=${token}`
      : `Use this token to reset your password: ${token}`;

    const organization = contact.organization ||
      (await this.organizationRepository.findOne({ where: { id: contact.organization_id } }));

    await this.notificationService.sendPasswordResetEmail(
      organization,
      contact.email,
      resetLink,
    );

    return { success: true };
  }

  async confirmPasswordReset(dto: ContactResetPasswordDto) {
    const contact = await this.contactRepository.findOne({
      where: { password_reset_token: dto.token },
    });
    if (!contact || !contact.password_reset_expires_at) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (contact.password_reset_expires_at < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    contact.password_hash = await bcrypt.hash(dto.password, 10);
    contact.is_active = true;
    contact.must_reset_password = false;
    contact.password_reset_token = null;
    contact.password_reset_expires_at = null;
    return this.contactRepository.save(contact);
  }
}
