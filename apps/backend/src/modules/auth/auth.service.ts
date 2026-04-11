import { Injectable, UnauthorizedException, NotFoundException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, QueryFailedError } from 'typeorm';
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
  EnableTwoFactorDto,
  VerifyTwoFactorLoginDto,
  TwoFactorRecoveryActionDto,
} from './dto/auth.dto';
import { NotificationService } from '../notification/notification.service';
import { validatePasswordStrength } from '../../common/security/password-policy';
import { TenantResolverService } from '../tenant/tenant-resolver.service';

const SUBDOMAIN_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const STAFF_INVITE_EXPIRY_DAYS = 7;
const TWO_FACTOR_CHALLENGE_PURPOSE = '2fa-login';
const TWO_FACTOR_DIGITS = 6;
const TWO_FACTOR_PERIOD_SECONDS = 30;
const TWO_FACTOR_SETUP_WINDOW_MINUTES = 10;
const TWO_FACTOR_RECOVERY_CODE_COUNT = 8;
const DUPLICATE_USER_EMAIL_MESSAGE = 'A user with this email already exists';

@Injectable()
export class AuthService {
  private twoFactorSchemaAvailable: boolean | null = null;

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
    private tenantResolverService: TenantResolverService,
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

    const savedUser = await this.saveUserWithDuplicateEmailHandling(user);

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
      throw new BadRequestException(DUPLICATE_USER_EMAIL_MESSAGE);
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
        <p>This invitation link expires in ${STAFF_INVITE_EXPIRY_DAYS} days.</p>
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
      invite_link: inviteLink || null,
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
      throw new BadRequestException(DUPLICATE_USER_EMAIL_MESSAGE);
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

    const savedUser = await this.saveUserWithDuplicateEmailHandling(user);
    invitation.accepted = true;
    invitation.accepted_at = new Date();
    await this.invitationRepository.save(invitation);

    const tokens = await this.createTokens(savedUser);
    return {
      ...tokens,
      user: this.mapAuthUser(savedUser),
    };
  }

  private async saveUserWithDuplicateEmailHandling(user: User): Promise<User> {
    try {
      return await this.userRepository.save(user);
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string; detail?: string } | undefined;
        const isDuplicateUserEmail = driverError?.code === '23505'
          && driverError.detail?.includes('(organization_id, email)');

        if (isDuplicateUserEmail) {
          throw new BadRequestException(DUPLICATE_USER_EMAIL_MESSAGE);
        }
      }

      throw error;
    }
  }

  async login(dto: LoginDto, requestHost?: string | null) {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const organizationId = await this.resolveLoginOrganizationId(dto, requestHost);

    if (organizationId) {
      const user = await this.userRepository.findOne({
        where: { email: normalizedEmail, organization_id: organizationId },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
      if (!isPasswordValid) {
        throw new UnauthorizedException('Invalid credentials');
      }

      return this.buildLoginSuccessResponse(user);
    }

    const users = await this.userRepository.find({
      where: { email: normalizedEmail },
      take: 2,
    });

    if (!users.length) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (users.length > 1) {
      throw new BadRequestException(
        'Organization context is required for this account. Log in from your organization subdomain or provide organization context.',
      );
    }

    const user = users[0];
    const isPasswordValid = await bcrypt.compare(dto.password, user.password_hash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.buildLoginSuccessResponse(user);
  }

  async getProfile(userId: string) {
    const user = await this.requireUser(userId, { includeTwoFactor: true });

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
      : '';

    if (!resetLink) {
      throw new NotFoundException('FRONTEND_URL is required to send password reset emails');
    }

    await this.notificationService.sendPasswordResetEmail(organization, user.email, resetLink, {
      expiresInText: '1 hour',
    });

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

  async getTwoFactorStatus(userId: string) {
    if (!(await this.isTwoFactorAvailable())) {
      return {
        available: false,
        enabled: false,
        setup_pending: false,
        recovery_codes_remaining: 0,
      };
    }

    const user = await this.requireUser(userId, { includeTwoFactor: true });

    return {
      available: true,
      enabled: user.two_factor_enabled,
      setup_pending:
        !!user.two_factor_temp_secret &&
        !!user.two_factor_temp_expires_at &&
        user.two_factor_temp_expires_at > new Date(),
      recovery_codes_remaining: this.getRecoveryCodeHashes(user).length,
    };
  }

  async initiateTwoFactorSetup(userId: string) {
    await this.assertTwoFactorAvailable();
    const user = await this.requireUser(userId, { includeTwoFactor: true });
    if (user.two_factor_enabled && user.two_factor_secret) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    const secret = this.generateBase32Secret();
    const expiresAt = new Date(Date.now() + TWO_FACTOR_SETUP_WINDOW_MINUTES * 60 * 1000);

    await this.userRepository.update(user.id, {
      two_factor_temp_secret: this.encryptSensitiveValue(secret),
      two_factor_temp_expires_at: expiresAt,
    });

    return {
      secret,
      manual_entry_key: secret,
      otpauth_url: this.buildOtpAuthUrl(user.email, secret),
      expires_at: expiresAt,
    };
  }

  async enableTwoFactor(userId: string, dto: EnableTwoFactorDto) {
    await this.assertTwoFactorAvailable();
    const user = await this.requireUser(userId, { includeTwoFactor: true });
    if (user.two_factor_enabled && user.two_factor_secret) {
      throw new BadRequestException('Two-factor authentication is already enabled');
    }

    if (!user.two_factor_temp_secret || !user.two_factor_temp_expires_at) {
      throw new BadRequestException('Two-factor setup has not been started');
    }

    if (user.two_factor_temp_expires_at < new Date()) {
      throw new BadRequestException('Two-factor setup has expired. Start setup again.');
    }

    const secret = this.decryptSensitiveValue(user.two_factor_temp_secret);
    if (!this.verifyTotpCode(secret, dto.code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }

    const recoveryCodes = this.generateRecoveryCodes();
    await this.userRepository.update(user.id, {
      two_factor_enabled: true,
      two_factor_secret: this.encryptSensitiveValue(secret),
      two_factor_temp_secret: null,
      two_factor_temp_expires_at: null,
      two_factor_recovery_codes: JSON.stringify(recoveryCodes.map(code => this.hashRecoveryCode(code))),
    });

    return {
      success: true,
      enabled: true,
      recovery_codes: recoveryCodes,
    };
  }

  async disableTwoFactor(userId: string, dto: TwoFactorRecoveryActionDto) {
    await this.assertTwoFactorAvailable();
    const user = await this.requireUser(userId, { includeTwoFactor: true });
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    await this.assertValidTwoFactorAction(user, dto, true);
    await this.userRepository.update(user.id, {
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_temp_secret: null,
      two_factor_temp_expires_at: null,
      two_factor_recovery_codes: null,
    });

    return { success: true, enabled: false };
  }

  async regenerateTwoFactorRecoveryCodes(userId: string, dto: TwoFactorRecoveryActionDto) {
    await this.assertTwoFactorAvailable();
    const user = await this.requireUser(userId, { includeTwoFactor: true });
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    await this.assertValidTwoFactorAction(user, dto, true);

    const recoveryCodes = this.generateRecoveryCodes();
    await this.userRepository.update(user.id, {
      two_factor_recovery_codes: JSON.stringify(recoveryCodes.map(code => this.hashRecoveryCode(code))),
    });

    return {
      success: true,
      recovery_codes: recoveryCodes,
    };
  }

  async verifyTwoFactorLogin(dto: VerifyTwoFactorLoginDto) {
    await this.assertTwoFactorAvailable();

    let payload: any;
    try {
      payload = this.jwtService.verify(dto.challenge_token);
    } catch (error) {
      throw new UnauthorizedException('Invalid or expired two-factor challenge');
    }

    if (payload?.purpose !== TWO_FACTOR_CHALLENGE_PURPOSE || !payload?.sub) {
      throw new UnauthorizedException('Invalid two-factor challenge');
    }

    const user = await this.requireUser(payload.sub, { includeTwoFactor: true });
    if (!user.two_factor_enabled || !user.two_factor_secret) {
      throw new BadRequestException('Two-factor authentication is not enabled for this account');
    }

    await this.assertValidTwoFactorAction(user, dto, true);

    const tokens = await this.createTokens(user);
    return {
      ...tokens,
      user: this.mapAuthUser(user),
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
      : '';

    if (!verificationLink) {
      throw new NotFoundException('FRONTEND_URL is required to send organization email verification');
    }

    await this.notificationService.sendOrganizationEmailVerificationEmail(
      organization,
      organization.email,
      verificationLink,
    );
  }

  async validateUser(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  private async buildLoginSuccessResponse(user: User) {
    const userWithTwoFactor = await this.hydrateUserWithTwoFactor(user);
    if (userWithTwoFactor.two_factor_enabled && userWithTwoFactor.two_factor_secret) {
      return {
        requires_two_factor: true,
        challenge_token: this.jwtService.sign(
          {
            sub: userWithTwoFactor.id,
            purpose: TWO_FACTOR_CHALLENGE_PURPOSE,
          },
          {
            expiresIn: this.configService.get('AUTH_TWO_FACTOR_CHALLENGE_TTL', '10m'),
          },
        ),
        challenge_expires_in: this.configService.get('AUTH_TWO_FACTOR_CHALLENGE_TTL', '10m'),
        user: this.mapAuthUser(userWithTwoFactor),
      };
    }

    const tokens = await this.createTokens(user);
    return {
      ...tokens,
      user: this.mapAuthUser(userWithTwoFactor),
    };
  }

  private async requireUser(userId: string, options?: { includeTwoFactor?: boolean }) {
    const user = options?.includeTwoFactor
      ? await this.findUserWithOptionalTwoFactor(userId)
      : await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
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
      two_factor_enabled: Boolean(user.two_factor_enabled),
    };
  }

  private async hydrateUserWithTwoFactor(user: User) {
    if (!(await this.isTwoFactorAvailable())) {
      return user;
    }

    return (await this.findUserWithOptionalTwoFactor(user.id)) ?? user;
  }

  private async findUserWithOptionalTwoFactor(userId: string) {
    if (!(await this.isTwoFactorAvailable())) {
      return this.userRepository.findOne({ where: { id: userId } });
    }

    return this.userRepository
      .createQueryBuilder('user')
      .addSelect([
        'user.two_factor_enabled',
        'user.two_factor_secret',
        'user.two_factor_temp_secret',
        'user.two_factor_temp_expires_at',
        'user.two_factor_recovery_codes',
      ])
      .where('user.id = :userId', { userId })
      .getOne();
  }

  private async assertTwoFactorAvailable() {
    if (!this.isTwoFactorFeatureEnabled()) {
      throw new BadRequestException('Two-factor authentication is currently disabled');
    }

    if (!(await this.hasTwoFactorSchema())) {
      throw new BadRequestException('Two-factor authentication is unavailable until the database migration is applied');
    }
  }

  private async isTwoFactorAvailable() {
    return this.isTwoFactorFeatureEnabled() && (await this.hasTwoFactorSchema());
  }

  private isTwoFactorFeatureEnabled() {
    const rawValue = this.configService.get<string>('AUTH_ENABLE_2FA');
    return ['1', 'true', 'yes', 'on'].includes(String(rawValue || '').trim().toLowerCase());
  }

  private async hasTwoFactorSchema() {
    if (this.twoFactorSchemaAvailable !== null) {
      return this.twoFactorSchemaAvailable;
    }

    try {
      const result = await this.userRepository.query(`
        SELECT COUNT(*)::int AS count
        FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'users'
          AND column_name IN (
            'two_factor_enabled',
            'two_factor_secret',
            'two_factor_temp_secret',
            'two_factor_temp_expires_at',
            'two_factor_recovery_codes'
          )
      `);

      this.twoFactorSchemaAvailable = Number(result?.[0]?.count ?? 0) === 5;
    } catch (error) {
      this.twoFactorSchemaAvailable = false;
    }

    return this.twoFactorSchemaAvailable;
  }

  private buildOtpAuthUrl(email: string, secret: string) {
    const issuer = 'Payforms';
    const label = encodeURIComponent(`${issuer}:${email}`);
    const issuerParam = encodeURIComponent(issuer);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuerParam}&algorithm=SHA1&digits=${TWO_FACTOR_DIGITS}&period=${TWO_FACTOR_PERIOD_SECONDS}`;
  }

  private generateBase32Secret(byteLength: number = 20) {
    return this.base32Encode(crypto.randomBytes(byteLength));
  }

  private base32Encode(buffer: Buffer) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';

    for (const byte of buffer) {
      value = (value << 8) | byte;
      bits += 8;

      while (bits >= 5) {
        output += alphabet[(value >>> (bits - 5)) & 31];
        bits -= 5;
      }
    }

    if (bits > 0) {
      output += alphabet[(value << (5 - bits)) & 31];
    }

    return output;
  }

  private base32Decode(value: string) {
    const normalized = value.replace(/=+$/g, '').replace(/\s+/g, '').toUpperCase();
    const lookup = new Map('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'.split('').map((char, index) => [char, index]));
    let bits = 0;
    let accumulator = 0;
    const output: number[] = [];

    for (const char of normalized) {
      const nextValue = lookup.get(char);
      if (nextValue === undefined) {
        throw new BadRequestException('Invalid two-factor secret');
      }

      accumulator = (accumulator << 5) | nextValue;
      bits += 5;

      if (bits >= 8) {
        output.push((accumulator >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }

    return Buffer.from(output);
  }

  private generateTotpCode(secret: string, counter: number) {
    const key = this.base32Decode(secret);
    const buffer = Buffer.alloc(8);
    const high = Math.floor(counter / 0x100000000);
    const low = counter % 0x100000000;
    buffer.writeUInt32BE(high, 0);
    buffer.writeUInt32BE(low, 4);

    const digest = crypto.createHmac('sha1', key).update(buffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);

    return String(binary % 10 ** TWO_FACTOR_DIGITS).padStart(TWO_FACTOR_DIGITS, '0');
  }

  private verifyTotpCode(secret: string, code?: string | null) {
    const normalizedCode = String(code || '').trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
      return false;
    }

    const currentCounter = Math.floor(Date.now() / 1000 / TWO_FACTOR_PERIOD_SECONDS);
    for (const offset of [-1, 0, 1]) {
      if (this.generateTotpCode(secret, currentCounter + offset) === normalizedCode) {
        return true;
      }
    }

    return false;
  }

  private generateRecoveryCodes() {
    return Array.from({ length: TWO_FACTOR_RECOVERY_CODE_COUNT }, () => {
      const value = this.base32Encode(crypto.randomBytes(5)).slice(0, 8);
      return `${value.slice(0, 4)}-${value.slice(4, 8)}`;
    });
  }

  private hashRecoveryCode(code: string) {
    return crypto.createHash('sha256').update(this.normalizeRecoveryCode(code)).digest('hex');
  }

  private normalizeRecoveryCode(code?: string | null) {
    return String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  }

  private getRecoveryCodeHashes(user: User) {
    if (!user.two_factor_recovery_codes) {
      return [];
    }

    try {
      const parsed = JSON.parse(user.two_factor_recovery_codes);
      return Array.isArray(parsed) ? parsed.filter(code => typeof code === 'string') : [];
    } catch {
      return [];
    }
  }

  private async assertValidTwoFactorAction(
    user: User,
    dto: TwoFactorRecoveryActionDto | VerifyTwoFactorLoginDto,
    consumeRecoveryCode: boolean,
  ) {
    const encryptedSecret = user.two_factor_secret;
    if (!encryptedSecret) {
      throw new BadRequestException('Two-factor authentication is not enabled');
    }

    const normalizedRecoveryCode = this.normalizeRecoveryCode(dto.recovery_code);
    if (!dto.code && !normalizedRecoveryCode) {
      throw new BadRequestException('Authentication code or recovery code is required');
    }

    if (dto.code) {
      const secret = this.decryptSensitiveValue(encryptedSecret);
      if (!this.verifyTotpCode(secret, dto.code)) {
        throw new UnauthorizedException('Invalid authentication code');
      }
      return;
    }

    const recoveryCodeHashes = this.getRecoveryCodeHashes(user);
    const recoveryCodeHash = this.hashRecoveryCode(normalizedRecoveryCode);
    const matchIndex = recoveryCodeHashes.findIndex(hash => hash === recoveryCodeHash);
    if (matchIndex < 0) {
      throw new UnauthorizedException('Invalid recovery code');
    }

    if (consumeRecoveryCode) {
      recoveryCodeHashes.splice(matchIndex, 1);
      await this.userRepository.update(user.id, {
        two_factor_recovery_codes: JSON.stringify(recoveryCodeHashes),
      });
      user.two_factor_recovery_codes = JSON.stringify(recoveryCodeHashes);
    }
  }

  private encryptSensitiveValue(value: string) {
    const iv = crypto.randomBytes(12);
    const key = this.getSensitiveEncryptionKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join('.');
  }

  private decryptSensitiveValue(payload: string) {
    const [ivText, authTagText, encryptedText] = String(payload || '').split('.');
    if (!ivText || !authTagText || !encryptedText) {
      throw new BadRequestException('Invalid encrypted value');
    }

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.getSensitiveEncryptionKey(),
      Buffer.from(ivText, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagText, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encryptedText, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  private getSensitiveEncryptionKey() {
    const secretMaterial =
      this.configService.get<string>('TWO_FACTOR_ENCRYPTION_KEY') ||
      this.configService.get<string>('JWT_SECRET') ||
      'payforms-default-secret';

    return crypto.createHash('sha256').update(secretMaterial).digest();
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

  private normalizeOptionalValue(value?: string | null) {
    if (value === undefined || value === null) {
      return null;
    }

    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private normalizeSubdomain(value?: string | null) {
    const normalized = this.normalizeOptionalValue(value)?.toLowerCase() ?? null;
    if (!normalized) {
      return null;
    }

    if (!SUBDOMAIN_PATTERN.test(normalized)) {
      throw new BadRequestException('Invalid organization_subdomain format');
    }

    return normalized;
  }

  private normalizeDomain(value?: string | null) {
    const normalized = this.normalizeOptionalValue(value)?.toLowerCase() ?? null;
    if (!normalized) {
      return null;
    }

    const withoutProtocol = normalized.replace(/^https?:\/\//, '');
    const withoutPath = withoutProtocol.split('/')[0];
    const withoutPort = withoutPath.replace(/:\d+$/, '');
    return withoutPort.replace(/\.$/, '');
  }

  private isTenantSubdomainHost(host: string) {
    const baseDomain = this.normalizeDomain(this.configService.get<string>('TENANT_BASE_DOMAIN'));
    if (!baseDomain) {
      return false;
    }

    const suffix = `.${baseDomain}`;
    if (!host.endsWith(suffix)) {
      return false;
    }

    const candidate = host.slice(0, -suffix.length);
    if (!candidate || candidate.includes('.')) {
      return false;
    }

    return !this.isReservedPlatformSubdomain(candidate);
  }

  private isReservedPlatformSubdomain(subdomain: string) {
    const reserved = (this.configService.get<string>('RESERVED_PLATFORM_SUBDOMAINS') || 'api,www')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean);

    return reserved.includes(subdomain.toLowerCase());
  }

  private async resolveLoginOrganizationId(dto: LoginDto, requestHost?: string | null) {
    const normalizedRequestHost = this.normalizeDomain(requestHost);
    const resolvedHostOrganization = normalizedRequestHost
      ? await this.tenantResolverService.resolveOrganizationFromHost(normalizedRequestHost)
      : null;

    if (normalizedRequestHost && this.isTenantSubdomainHost(normalizedRequestHost) && !resolvedHostOrganization) {
      throw new BadRequestException('Unknown organization subdomain');
    }

    const explicitOrganizationId = this.normalizeOptionalValue(dto.organization_id);
    let resolvedExplicitOrganizationId: string | null = explicitOrganizationId;

    const explicitSubdomain = this.normalizeSubdomain(dto.organization_subdomain);
    if (explicitSubdomain) {
      const organization = await this.organizationRepository.findOne({
        where: { subdomain: explicitSubdomain },
        select: ['id'],
      });
      if (!organization) {
        throw new BadRequestException('Invalid organization context');
      }
      resolvedExplicitOrganizationId = organization.id;
    }

    const explicitDomain = this.normalizeDomain(dto.organization_domain);
    if (explicitDomain) {
      const organization = await this.organizationRepository.findOne({
        where: { custom_domain: explicitDomain },
        select: ['id'],
      });
      if (!organization) {
        throw new BadRequestException('Invalid organization context');
      }
      resolvedExplicitOrganizationId = organization.id;
    }

    if (
      resolvedHostOrganization &&
      resolvedExplicitOrganizationId &&
      resolvedHostOrganization.organization_id !== resolvedExplicitOrganizationId
    ) {
      throw new BadRequestException('Organization context mismatch with request host');
    }

    if (resolvedHostOrganization) {
      return resolvedHostOrganization.organization_id;
    }

    return resolvedExplicitOrganizationId;
  }

  private generateOpaqueToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashOpaqueToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
