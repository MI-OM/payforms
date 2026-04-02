import { Injectable, UnauthorizedException, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';
import { Invitation } from './entities/invitation.entity';
import { Organization } from '../organization/entities/organization.entity';
import {
  RegisterDto,
  LoginDto,
  RefreshTokenDto,
  InviteUserDto,
  AcceptInviteDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  VerifyOrganizationEmailDto,
} from './dto/auth.dto';
import { NotificationService } from '../notification/notification.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Invitation)
    private invitationRepository: Repository<Invitation>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private jwtService: JwtService,
    private configService: ConfigService,
    private notificationService: NotificationService,
  ) {}

  async register(dto: RegisterDto) {
    // Create organization
    const organization = this.organizationRepository.create({
      name: dto.organization_name,
      email: dto.email,
    });
    const savedOrg = await this.organizationRepository.save(organization);

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // Create admin user
    const user = this.userRepository.create({
      organization_id: savedOrg.id,
      email: dto.email,
      title: dto.title ?? null,
      designation: dto.designation ?? null,
      password_hash: passwordHash,
      role: 'ADMIN',
    });

    const savedUser = await this.userRepository.save(user);

    try {
      await this.sendOrganizationEmailVerification(savedOrg);
    } catch (error) {
      console.error('Failed to send organization email verification:', error);
    }

    const tokens = await this.createTokens(savedUser);

    return {
      ...tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        organization_id: savedUser.organization_id,
        title: savedUser.title,
        designation: savedUser.designation,
      },
    };
  }

  async inviteUser(inviter: User, dto: InviteUserDto) {
    const organizationId = inviter.organization_id;

    if (dto.role && dto.role === 'ADMIN' && inviter.role !== 'ADMIN') {
      throw new ForbiddenException('Only ADMIN can invite another ADMIN');
    }

    const existingUser = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const existingInvite = await this.invitationRepository.findOne({
      where: { email: dto.email, organization_id: organizationId, accepted: false },
    });
    if (existingInvite) {
      await this.invitationRepository.delete({ id: existingInvite.id });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const invitation = this.invitationRepository.create({
      organization_id: organizationId,
      email: dto.email,
      title: dto.title ?? null,
      designation: dto.designation ?? null,
      role: dto.role || 'STAFF',
      token,
      invited_by: inviter.id,
      accepted: false,
      accepted_at: null,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const savedInvite = await this.invitationRepository.save(invitation);
    return {
      id: savedInvite.id,
      email: savedInvite.email,
      title: savedInvite.title,
      designation: savedInvite.designation,
      role: savedInvite.role,
      token: savedInvite.token,
      expires_at: savedInvite.expires_at,
      created_at: savedInvite.created_at,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const invitation = await this.invitationRepository.findOne({
      where: { token: dto.token },
    });

    if (!invitation || invitation.accepted) {
      throw new BadRequestException('Invalid or expired invitation token');
    }

    if (invitation.expires_at && invitation.expires_at < new Date()) {
      throw new BadRequestException('Invitation token has expired');
    }

    const existingUser = await this.userRepository.findOne({ where: { email: invitation.email } });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = this.userRepository.create({
      organization_id: invitation.organization_id,
      email: invitation.email,
      title: dto.title ?? invitation.title ?? null,
      designation: dto.designation ?? invitation.designation ?? null,
      password_hash: passwordHash,
      role: invitation.role,
    });

    const savedUser = await this.userRepository.save(user);
    invitation.accepted = true;
    invitation.accepted_at = new Date();
    await this.invitationRepository.save(invitation);

    const tokens = await this.createTokens(savedUser);
    return {
      ...tokens,
      user: {
        id: savedUser.id,
        email: savedUser.email,
        role: savedUser.role,
        organization_id: savedUser.organization_id,
        title: savedUser.title,
        designation: savedUser.designation,
      },
    };
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.createTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        organization_id: user.organization_id,
        title: user.title,
        designation: user.designation,
      },
    };
  }

  async refreshTokens(dto: RefreshTokenDto) {
    let payload: any;
    try {
      payload = this.jwtService.verify(dto.refresh_token);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.refresh_token_hash) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshTokenMatches = await bcrypt.compare(dto.refresh_token, user.refresh_token_hash);
    if (!refreshTokenMatches) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.createTokens(user);
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refresh_token_hash: null });
    return { success: true };
  }

  async requestPasswordReset(dto: PasswordResetRequestDto) {
    const user = await this.userRepository.findOne({ where: { email: dto.email } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.password_reset_token = token;
    user.password_reset_expires_at = new Date(Date.now() + 1000 * 60 * 60);
    await this.userRepository.save(user);

    const organization = await this.organizationRepository.findOne({
      where: { id: user.organization_id },
    });

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const resetLink = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/reset-password?token=${token}`
      : `Use this token to reset your password: ${token}`;

    await this.notificationService.sendPasswordResetEmail(
      organization,
      user.email,
      resetLink,
    );

    return { success: true };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    const user = await this.userRepository.findOne({
      where: { password_reset_token: dto.token },
    });

    if (!user || !user.password_reset_expires_at) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.password_reset_expires_at < new Date()) {
      throw new BadRequestException('Reset token has expired');
    }

    user.password_hash = await bcrypt.hash(dto.password, 10);
    user.refresh_token_hash = null;
    user.password_reset_token = null;
    user.password_reset_expires_at = null;
    await this.userRepository.save(user);

    return { success: true };
  }

  async requestOrganizationEmailVerification(requester: User) {
    const organization = await this.organizationRepository.findOne({
      where: { id: requester.organization_id },
    });
    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.email_verified) {
      return { success: true, email_verified: true };
    }

    await this.sendOrganizationEmailVerification(organization);
    return { success: true, email_verified: false };
  }

  async verifyOrganizationEmail(dto: VerifyOrganizationEmailDto) {
    const organization = await this.organizationRepository.findOne({
      where: { email_verification_token: dto.token },
    });

    if (!organization || !organization.email_verification_expires_at) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (organization.email_verification_expires_at < new Date()) {
      throw new BadRequestException('Verification token has expired');
    }

    organization.email_verified = true;
    organization.email_verification_token = null;
    organization.email_verification_expires_at = null;
    await this.organizationRepository.save(organization);

    return { success: true, organization_id: organization.id, email_verified: true };
  }

  async getOrganizationEmailVerificationStatus(requester: User) {
    const organization = await this.organizationRepository.findOne({
      where: { id: requester.organization_id },
      select: ['id', 'email', 'email_verified'],
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    return {
      organization_id: organization.id,
      email: organization.email,
      email_verified: organization.email_verified,
    };
  }

  private async createTokens(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
      organization_id: user.organization_id,
      role: user.role,
      title: user.title,
      designation: user.designation,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: '7d',
    });

    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: '30d',
    });

    await this.setRefreshTokenHash(user.id, refresh_token);

    return {
      access_token,
      refresh_token,
    };
  }

  private async setRefreshTokenHash(userId: string, refreshToken: string) {
    const hash = await bcrypt.hash(refreshToken, 10);
    await this.userRepository.update(userId, { refresh_token_hash: hash });
  }

  private async sendOrganizationEmailVerification(organization: Organization) {
    const token = crypto.randomBytes(32).toString('hex');
    organization.email_verification_token = token;
    organization.email_verification_expires_at = new Date(Date.now() + 1000 * 60 * 60 * 24);
    organization.email_verified = false;
    await this.organizationRepository.save(organization);

    const frontendUrl = this.configService.get('FRONTEND_URL');
    const verificationLink = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/verify-organization-email?token=${token}`
      : `Use this token to verify your organization email: ${token}`;

    await this.notificationService.sendOrganizationEmailVerificationEmail(
      organization,
      organization.email,
      verificationLink,
    );
  }

  async validateUser(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }
}
