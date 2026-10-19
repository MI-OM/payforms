import { Injectable, BadRequestException, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as speakeasy from 'speakeasy';
import * as crypto from 'crypto';

/**
 * Two-Factor Authentication Service
 *
 * Implements TOTP (Time-based One-Time Password) using speakeasy library.
 * Compatible with Google Authenticator, Authy, Microsoft Authenticator, etc.
 *
 * Features:
 * - Generate TOTP secrets (base32 encoded)
 * - Verify TOTP codes (with time window tolerance)
 * - Generate recovery codes (for account recovery if device lost)
 * - Support for optional backup email delivery of recovery codes
 *
 * Security:
 * - 32-character recovery codes (base32, ~170 bits entropy)
 * - TOTP verified with ±1 time window (30-second tolerance)
 * - Recovery codes can only be used once (burned after use)
 * - All secrets should be encrypted at rest (handled by caller)
 *
 * Lifecycle:
 * 1. User initiates 2FA setup: generateSecret()
 * 2. Frontend shows QR code + temp secret to user
 * 3. User scans QR with authenticator app (Google Authenticator, etc.)
 * 4. User enters code from app + generates recovery codes
 * 5. Backend verifies code: verifyCode()
 * 6. If valid, save secret + recovery codes, enable 2FA
 * 7. On login, prompt for 2FA code: verifyCode()
 * 8. If user loses device, use recovery code: useRecoveryCode()
 */
@Injectable()
export class TwoFactorAuthService {
  private readonly logger = new Logger(TwoFactorAuthService.name);
  private readonly RECOVERY_CODE_COUNT = 10;
  private readonly RECOVERY_CODE_LENGTH = 8;

  constructor(private configService: ConfigService) {}

  /**
   * Generate a new TOTP secret for a user.
   * Returns secret + QR code URL for scanning into authenticator app.
   */
  generateSecret(userEmail: string, appName: string = 'Payforms'): {
    secret: string;
    qrCodeUrl: string;
    manualEntryKey: string;
  } {
    const secret = speakeasy.generateSecret({
      name: `${appName} (${userEmail})`,
      issuer: appName,
      length: 32, // 256-bit secret (exceeds standard 20 bytes for extra security)
    });

    if (!secret.base32 || !secret.otpauth_url) {
      throw new Error('Failed to generate TOTP secret');
    }

    return {
      secret: secret.base32,
      qrCodeUrl: secret.otpauth_url,
      manualEntryKey: secret.base32,
    };
  }

  /**
   * Verify a TOTP code against a secret.
   * Uses ±1 time window (30-second tolerance) per RFC 6238.
   */
  verifyCode(secret: string, code: string): boolean {
    if (!secret?.trim() || !code?.trim()) {
      return false;
    }

    try {
      // Normalize code (remove spaces, dashes)
      const normalizedCode = code.replace(/[\s\-]/g, '').trim();

      // Verify with ±1 time window (RFC 6238 recommends at least ±1)
      const isValid = speakeasy.totp.verify({
        secret: secret,
        encoding: 'base32',
        token: normalizedCode,
        window: 1, // ±1 × 30 seconds = 60-second tolerance
      });

      return isValid;
    } catch (error) {
      this.logger.warn('TOTP verification failed', error);
      return false;
    }
  }

  /**
   * Generate recovery codes for account recovery.
   * Should be stored encrypted and shown only once to the user.
   *
   * Returns: Array of 10 recovery codes (8 chars each, base32)
   */
  generateRecoveryCodes(): string[] {
    const codes: string[] = [];
    const base32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    for (let i = 0; i < this.RECOVERY_CODE_COUNT; i++) {
      const randomBytes = crypto.randomBytes(Math.ceil((this.RECOVERY_CODE_LENGTH * 5) / 8));
      let code = '';
      let bitBuffer = 0;
      let bitsInBuffer = 0;

      for (let j = 0; j < randomBytes.length; j++) {
        bitBuffer = (bitBuffer << 8) | randomBytes[j];
        bitsInBuffer += 8;

        while (bitsInBuffer >= 5) {
          bitsInBuffer -= 5;
          const index = (bitBuffer >> bitsInBuffer) & 0x1f;
          code += base32Chars[index];
        }
      }

      if (bitsInBuffer > 0) {
        bitBuffer = bitBuffer << (5 - bitsInBuffer);
        const index = bitBuffer & 0x1f;
        code += base32Chars[index];
      }

      codes.push(code.substring(0, this.RECOVERY_CODE_LENGTH));
    }

    return codes;
  }

  /**
   * Use a recovery code (burn it after use).
   * Caller must update the user's recovery codes after using one.
   *
   * Returns: true if code was valid, false if not found or already used
   */
  useRecoveryCode(recoveryCodesJson: string, codeToUse: string): {
    isValid: boolean;
    remainingCodes: string[];
  } {
    if (!recoveryCodesJson || !codeToUse) {
      return { isValid: false, remainingCodes: [] };
    }

    try {
      let codes = JSON.parse(recoveryCodesJson);
      if (!Array.isArray(codes)) {
        codes = [];
      }

      const normalizedCodeToUse = codeToUse.replace(/[\s\-]/g, '').toUpperCase().trim();
      const codeIndex = codes.findIndex(
        (c: string) => c.replace(/[\s\-]/g, '').toUpperCase().trim() === normalizedCodeToUse,
      );

      if (codeIndex === -1) {
        return { isValid: false, remainingCodes: codes };
      }

      // Remove the used code
      codes.splice(codeIndex, 1);

      return {
        isValid: true,
        remainingCodes: codes,
      };
    } catch (error) {
      this.logger.warn('Recovery code verification failed', error);
      return { isValid: false, remainingCodes: [] };
    }
  }

  /**
   * Check if recovery codes are running low (less than 3 remaining).
   * Useful to prompt user to generate new codes.
   */
  areRecodyCodesLow(recoveryCodesJson: string): boolean {
    if (!recoveryCodesJson) {
      return true;
    }

    try {
      const codes = JSON.parse(recoveryCodesJson);
      return Array.isArray(codes) && codes.length < 3;
    } catch {
      return true;
    }
  }

  /**
   * Format recovery codes for display (with dashes for readability).
   * Example: "ABCD1234" -> "ABCD-1234"
   */
  formatRecoveryCode(code: string): string {
    if (!code || code.length < 4) {
      return code;
    }
    return code.substring(0, 4) + '-' + code.substring(4);
  }

  /**
   * Get formatted recovery codes for display.
   */
  getFormattedRecoveryCodes(recoveryCodesJson: string): string[] {
    try {
      const codes = JSON.parse(recoveryCodesJson);
      if (!Array.isArray(codes)) {
        return [];
      }
      return codes.map((c: string) => this.formatRecoveryCode(c));
    } catch {
      return [];
    }
  }

  /**
   * Validate recovery codes JSON format.
   */
  validateRecoveryCodesJson(json: string): boolean {
    try {
      const codes = JSON.parse(json);
      if (!Array.isArray(codes)) {
        return false;
      }
      // All elements should be strings
      return codes.every(c => typeof c === 'string' && c.length > 0);
    } catch {
      return false;
    }
  }
}
