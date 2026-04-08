import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
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
  UpdateProfileDto,
  PasswordResetRequestDto,
  PasswordResetConfirmDto,
  VerifyOrganizationEmailDto,
} from './dto/auth.dto';
import { NotificationService } from '../notification/notification.service';
import { validatePasswordStrength } from '../../common/security/password-policy';

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
    validatePasswordStrength(dto.password);

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
      first_name: null,
      middle_name: null,
      last_name: null,
      title: null,
      designation: null,
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
      user: this.mapAuthUser(savedUser),
    };
  }

  async inviteUser(inviter: User, dto: InviteUserDto) {
    const organizationId = inviter.organization_id;
    const email = this.normalizeEmail(dto.email);

    const existingUser = await this.userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw new BadRequestException('A user with this email already exists');
    }

    const existingInvite = await this.invitationRepository.findOne({
      where: { email, organization_id: organizationId, accepted: false },
    });
    if (existingInvite) {
      if (existingInvite.expires_at && existingInvite.expires_at > new Date()) {
        throw new BadRequestException('An active invitation already exists for this email');
      }
      await this.invitationRepository.delete({ id: existingInvite.id });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const invitation = this.invitationRepository.create({
      organization_id: organizationId,
      email,
      first_name: dto.first_name.trim(),
      last_name: dto.last_name.trim(),
      role: 'STAFF',
      token,
      invited_by: inviter.id,
      accepted: false,
      accepted_at: null,
      expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
    });

    const savedInvite = await this.invitationRepository.save(invitation);
    const organization = await this.organizationRepository.findOne({
      where: { id: organizationId },
      select: ['id', 'name'],
    });

    const frontendUrl = this.configService.get<string>('FRONTEND_URL');
    const inviteLink = frontendUrl
      ? `${frontendUrl.replace(/\/$/, '')}/accept-invite?token=${savedInvite.token}`
      : '';

    let inviteEmailSent = false;
    try {
      const subject = `${organization?.name || 'Payforms'} Staff Invitation`;
      const html = `
        <p>Hello ${savedInvite.first_name},</p>
        <p>You have been invited to join ${organization?.name || 'an organization'} on Payforms.</p>
        ${inviteLink ? `<p>Accept invitation: <a href="${inviteLink}">${inviteLink}</a></p>` : ''}
        <p>Invitation token: <strong>${savedInvite.token}</strong></p>
        <p>This invitation expires on ${savedInvite.expires_at?.toISOString() || 'N/A'}.</p>
      `;

      await this.notificationService.sendEmail([savedInvite.email], subject, html);
      inviteEmailSent = true;
    } catch (error) {
      console.warn('Failed to send invitation email:', error);
    }

    return {
      id: savedInvite.id,
      email: savedInvite.email,
      first_name: savedInvite.first_name,
      last_name: savedInvite.last_name,
      role: savedInvite.role,
      token: savedInvite.token,
      expires_at: savedInvite.expires_at,
      created_at: savedInvite.created_at,
      invite_email_sent: inviteEmailSent,
    };
  }

  async acceptInvite(dto: AcceptInviteDto) {
    validatePasswordStrength(dto.password);

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
      first_name: invitation.first_name ?? null,
      middle_name: null,
      last_name: invitation.last_name ?? null,
      title: null,
      designation: null,
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
      user: this.mapAuthUser(savedUser),
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
      user: this.mapAuthUser(user),
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.mapAuthUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatePayload: Partial<User> = {};

    if (dto.first_name !== undefined) {
      updatePayload.first_name = this.normalizeProfileField(dto.first_name);
    }
    if (dto.middle_name !== undefined) {
      updatePayload.middle_name = this.normalizeProfileField(dto.middle_name);
    }
    if (dto.last_name !== undefined) {
      updatePayload.last_name = this.normalizeProfileField(dto.last_name);
    }
    if (dto.title !== undefined) {
      updatePayload.title = this.normalizeProfileField(dto.title);
    }
    if (dto.designation !== undefined) {
      updatePayload.designation = this.normalizeProfileField(dto.designation);
    }

    if (Object.keys(updatePayload).length > 0) {
      await this.userRepository.update(userId, updatePayload);
    }

    return this.getProfile(userId);
  }

  async refreshTokens(dto: RefreshTokenDto) {
    if (!dto.refresh_token) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const refreshToken = dto.refresh_token;
    let payload: any;
    try {
      payload = this.jwtService.verify(refreshToken);
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user || !user.refresh_token_hash) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    const refreshTokenMatches = await bcrypt.compare(refreshToken, user.refresh_token_hash);
    if (!refreshTokenMatches) {
      await this.userRepository.update(user.id, { refresh_token_hash: null });
      throw new UnauthorizedException('Invalid refresh token');
    }

    return this.createTokens(user);
  }

  async logout(userId: string) {
    await this.userRepository.update(userId, { refresh_token_hash: null });
    return { success: true };
  }

  async requestPasswordReset(dto: PasswordResetRequestDto) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.userRepository.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return {
        success: true,
        message: 'If an account exists for this email, a password reset link has been sent.',
      };
    }

    const token = this.generateOpaqueToken();
    user.password_reset_token = this.hashOpaqueToken(token);
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

    return {
      success: true,
      message: 'If an account exists for this email, a password reset link has been sent.',
    };
  }

  async confirmPasswordReset(dto: PasswordResetConfirmDto) {
    validatePasswordStrength(dto.password);
    const hashedToken = this.hashOpaqueToken(dto.token);
    const user = await this.userRepository.findOne({
      where: { password_reset_token: In([hashedToken, dto.token]) },
    });

    if (!user || !user.password_reset_expires_at) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.password_reset_expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired reset token');
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
    const hashedToken = this.hashOpaqueToken(dto.token);
    const organization = await this.organizationRepository.findOne({
      where: { email_verification_token: In([hashedToken, dto.token]) },
    });

    if (!organization || !organization.email_verification_expires_at) {
      throw new BadRequestException('Invalid or expired verification token');
    }

    if (organization.email_verification_expires_at < new Date()) {
      throw new BadRequestException('Invalid or expired verification token');
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
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      title: user.title,
      designation: user.designation,
    };

    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('AUTH_ACCESS_TOKEN_TTL', '15m'),
    });

    const refresh_token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('AUTH_REFRESH_TOKEN_TTL', '30d'),
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
    const token = this.generateOpaqueToken();
    organization.email_verification_token = this.hashOpaqueToken(token);
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

  private mapAuthUser(user: User) {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      title: user.title,
      designation: user.designation,
    };
  }

  private normalizeProfileField(value: string | null | undefined) {
    if (value === undefined || value === null) {
      return null;
    }
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateOpaqueToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashOpaqueToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
