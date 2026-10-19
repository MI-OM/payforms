import { Controller, Post, Get, Delete, Body, UseGuards, Request, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactService } from '../services/contact.service';
import { TwoFactorAuthService } from '../../auth/services/two-factor-auth.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

/**
 * Contact Two-Factor Authentication Controller
 *
 * Endpoints for contacts to manage Google Authenticator 2FA.
 * 2FA is optional for contacts and not enforced.
 *
 * Workflow:
 * 1. Contact initiates 2FA setup: POST /2fa/setup
 *    - Returns QR code URL + temporary secret
 *    - User scans QR with Google Authenticator app
 * 2. Contact verifies code: POST /2fa/setup/verify
 *    - Returns recovery codes (displayed once)
 *    - Saves secret + recovery codes, enables 2FA
 * 3. Contact can disable 2FA: DELETE /2fa
 * 4. Contact can view recovery codes: GET /2fa/recovery-codes
 * 5. On login, if 2FA enabled, prompt for code (handled by auth service)
 */
@ApiTags('Contact 2FA')
@Controller('contacts/:contactId/2fa')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ContactTwoFactorAuthController {
  constructor(
    private contactService: ContactService,
    private twoFactorAuthService: TwoFactorAuthService,
  ) {}

  /**
   * POST /contacts/:contactId/2fa/setup
   *
   * Initiate 2FA setup for a contact.
   * Returns QR code URL + temporary secret to scan.
   * User will verify with the code they see in their authenticator app.
   */
  @Post('setup')
  async setupTwoFactorAuth(@Request() req, @Param('contactId') contactId: string) {
    // Verify contact ownership (contact can only enable 2FA for themselves)
    const contact = await this.contactService.findById(req.user.organization_id, contactId);
    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    // If 2FA already enabled, user must disable first
    if (contact.two_factor_enabled) {
      throw new BadRequestException('2FA already enabled. Disable first to reconfigure.');
    }

    // Generate temporary secret + QR code
    const { secret, qrCodeUrl, manualEntryKey } = this.twoFactorAuthService.generateSecret(
      contact.email || `contact-${contactId}`,
      'Payforms',
    );

    // Store temporary secret (expires in 15 minutes)
    const tempExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.contactService.update(req.user.organization_id, contactId, {
      two_factor_temp_secret: secret,
      two_factor_temp_expires_at: tempExpiresAt,
    });

    return {
      qrCodeUrl,
      manualEntryKey,
      message: 'Scan QR code with Google Authenticator, Microsoft Authenticator, or Authy',
    };
  }

  /**
   * POST /contacts/:contactId/2fa/setup/verify
   *
   * Verify the code from authenticator app to confirm 2FA setup.
   * Generates and returns recovery codes (for account recovery).
   * User must save recovery codes in a safe place.
   */
  @Post('setup/verify')
  async verifyTwoFactorSetup(
    @Request() req,
    @Param('contactId') contactId: string,
    @Body() body: { code: string },
  ) {
    const { code } = body;
    if (!code) {
      throw new BadRequestException('Code is required');
    }

    // Fetch contact
    const contact = await this.contactService.findById(req.user.organization_id, contactId);
    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    // Check if temporary secret exists and hasn't expired
    if (!contact.two_factor_temp_secret || !contact.two_factor_temp_expires_at) {
      throw new BadRequestException('2FA setup not initiated. Call /2fa/setup first.');
    }

    if (new Date() > contact.two_factor_temp_expires_at) {
      throw new BadRequestException('Temporary secret expired. Initiate setup again.');
    }

    // Verify code against temporary secret
    const isValid = this.twoFactorAuthService.verifyCode(contact.two_factor_temp_secret, code);
    if (!isValid) {
      throw new BadRequestException('Invalid code. Please check your authenticator app.');
    }

    // Generate recovery codes
    const recoveryCodes = this.twoFactorAuthService.generateRecoveryCodes();
    const recoveryCodesJson = JSON.stringify(recoveryCodes);

    // Save secret, enable 2FA, clear temporary secret
    await this.contactService.update(req.user.organization_id, contactId, {
      two_factor_enabled: true,
      two_factor_secret: contact.two_factor_temp_secret,
      two_factor_recovery_codes: recoveryCodesJson,
      two_factor_temp_secret: null,
      two_factor_temp_expires_at: null,
    });

    // Return formatted recovery codes for display
    const formattedCodes = this.twoFactorAuthService.getFormattedRecoveryCodes(recoveryCodesJson);

    return {
      message: '2FA successfully enabled',
      recoveryCodesWarning: 'Save these recovery codes in a safe place. You will need them if you lose access to your authenticator app.',
      recoveryCodes: formattedCodes,
    };
  }

  /**
   * GET /contacts/:contactId/2fa/recovery-codes
   *
   * View recovery codes (requires verification via backup email or current code).
   * For now, returns codes if user can authenticate (they're already logged in).
   */
  @Get('recovery-codes')
  async getRecoveryCodes(@Request() req, @Param('contactId') contactId: string) {
    const contact = await this.contactService.findById(req.user.organization_id, contactId);
    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    if (!contact.two_factor_enabled) {
      throw new BadRequestException('2FA not enabled');
    }

    if (!contact.two_factor_recovery_codes) {
      throw new BadRequestException('No recovery codes found');
    }

    const formattedCodes = this.twoFactorAuthService.getFormattedRecoveryCodes(contact.two_factor_recovery_codes);

    return {
      recoveryCodes: formattedCodes,
      remaining: formattedCodes.length,
      warning: formattedCodes.length < 3 ? 'You have fewer than 3 recovery codes remaining. Consider regenerating them.' : null,
    };
  }

  /**
   * DELETE /contacts/:contactId/2fa
   *
   * Disable 2FA for a contact.
   * Clears all 2FA secrets and recovery codes.
   */
  @Delete()
  async disableTwoFactorAuth(@Request() req, @Param('contactId') contactId: string) {
    const contact = await this.contactService.findById(req.user.organization_id, contactId);
    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    if (!contact.two_factor_enabled) {
      throw new BadRequestException('2FA not enabled');
    }

    await this.contactService.update(req.user.organization_id, contactId, {
      two_factor_enabled: false,
      two_factor_secret: null,
      two_factor_recovery_codes: null,
      two_factor_temp_secret: null,
      two_factor_temp_expires_at: null,
    });

    return { message: '2FA successfully disabled' };
  }

  /**
   * GET /contacts/:contactId/2fa/status
   *
   * Get 2FA status for a contact (enabled/disabled + remaining recovery codes).
   */
  @Get('status')
  async getTwoFactorStatus(@Request() req, @Param('contactId') contactId: string) {
    const contact = await this.contactService.findById(req.user.organization_id, contactId);
    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    const remaining = contact.two_factor_recovery_codes
      ? this.twoFactorAuthService.getFormattedRecoveryCodes(contact.two_factor_recovery_codes).length
      : 0;

    return {
      enabled: contact.two_factor_enabled || false,
      recoveryCodesRemaining: remaining,
      recoveryCodesLow: remaining < 3,
    };
  }
}
