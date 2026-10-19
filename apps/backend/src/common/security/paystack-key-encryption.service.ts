import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Encrypts and decrypts per-organization Paystack secret keys before they are
 * stored in the database.
 *
 * Algorithm: AES-256-GCM (authenticated encryption — any ciphertext
 * modification is detected and rejected at decryption time).
 *
 * Stored format (colon-delimited):
 *   `<version>:<iv_hex>:<tag_hex>:<ciphertext_hex>`
 *
 * Where:
 *   version    = "1"  (increment when the algorithm or key derivation changes)
 *   iv_hex     = 24 hex chars (12-byte random IV)
 *   tag_hex    = 32 hex chars (16-byte GCM auth tag)
 *   ciphertext = variable-length hex
 *
 * Key source: `PAYSTACK_KEY_ENCRYPTION_KEY` environment variable — a
 * cryptographically random 32-byte value encoded as 64 lowercase hex chars.
 * Generate with: `openssl rand -hex 32`
 *
 * The key is loaded once at startup; if it is absent the service logs a
 * prominent warning and operates in PASSTHROUGH mode (no encryption), so
 * existing deployments without the key configured do not break. Set the key
 * and run the backfill migration to enable encryption.
 *
 * IMPORTANT:
 * - Never store this key alongside the database password.
 * - Store it as a separate Render/deployment secret.
 * - Back it up securely — without it, encrypted ciphertext cannot be decrypted.
 * - Key rotation requires a data migration (decrypt with old key, encrypt with new).
 */
@Injectable()
export class PaystackKeyEncryptionService implements OnModuleInit {
  private readonly logger = new Logger(PaystackKeyEncryptionService.name);
  private keyBuffer: Buffer | null = null;
  private readonly ALGORITHM = 'aes-256-gcm' as const;
  private readonly IV_BYTES = 12;
  private readonly TAG_BYTES = 16;
  private readonly VERSION = '1';

  constructor(private readonly configService: ConfigService) {}

  onModuleInit(): void {
    const raw = this.configService.get<string>('PAYSTACK_KEY_ENCRYPTION_KEY');

    if (!raw || !raw.trim()) {
      this.logger.warn(
        '⚠️  PAYSTACK_KEY_ENCRYPTION_KEY is not set. ' +
        'Paystack secret keys will be stored WITHOUT encryption. ' +
        'Generate a key with `openssl rand -hex 32` and set it as a Render secret to enable encryption.',
      );
      return;
    }

    const hex = raw.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error(
        'PAYSTACK_KEY_ENCRYPTION_KEY must be exactly 64 lowercase hex characters (32 bytes). ' +
        'Generate one with: openssl rand -hex 32',
      );
    }

    this.keyBuffer = Buffer.from(hex, 'hex');
    this.logger.log('Paystack key encryption enabled (AES-256-GCM).');
  }

  /**
   * Returns true when a valid encryption key is loaded. When false, the service
   * passes values through unchanged and logs a warning on every operation.
   */
  get isEnabled(): boolean {
    return this.keyBuffer !== null;
  }

  /**
   * Encrypts a plaintext Paystack secret key for storage.
   *
   * @param plaintext  The raw `sk_live_...` or `sk_test_...` key value.
   * @returns          Encrypted envelope string, or the original value if
   *                   encryption is not configured (passthrough mode).
   */
  encrypt(plaintext: string): string {
    if (!plaintext) {
      return plaintext;
    }

    if (!this.keyBuffer) {
      return plaintext; // passthrough
    }

    const iv = crypto.randomBytes(this.IV_BYTES);
    const cipher = crypto.createCipheriv(this.ALGORITHM, this.keyBuffer, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
      this.VERSION,
      iv.toString('hex'),
      tag.toString('hex'),
      encrypted.toString('hex'),
    ].join(':');
  }

  /**
   * Decrypts an encrypted Paystack secret key retrieved from the database.
   *
   * Handles three cases:
   *   1. Value is already in the encrypted envelope format → decrypt and return.
   *   2. Value is plaintext (legacy, pre-encryption) → return as-is.
   *   3. Value is null/undefined/empty → return as-is.
   *
   * @throws Error if ciphertext is tampered (GCM authentication failure).
   */
  decrypt(stored: string | null | undefined): string | null {
    if (!stored) {
      return stored ?? null;
    }

    if (!this.isEncrypted(stored)) {
      // Plaintext legacy value — return unchanged.
      return stored;
    }

    if (!this.keyBuffer) {
      this.logger.error(
        'Encountered an encrypted Paystack key in the database but ' +
        'PAYSTACK_KEY_ENCRYPTION_KEY is not set. ' +
        'Payment operations requiring this key will fail.',
      );
      return null;
    }

    const parts = stored.split(':');
    if (parts.length !== 4) {
      throw new Error('Malformed encrypted Paystack key: unexpected number of segments');
    }

    const [version, ivHex, tagHex, ciphertextHex] = parts;

    if (version !== this.VERSION) {
      throw new Error(`Unsupported encrypted Paystack key version: ${version}`);
    }

    try {
      const iv = Buffer.from(ivHex, 'hex');
      const tag = Buffer.from(tagHex, 'hex');
      const ciphertext = Buffer.from(ciphertextHex, 'hex');

      const decipher = crypto.createDecipheriv(this.ALGORITHM, this.keyBuffer, iv);
      decipher.setAuthTag(tag);

      const decrypted = Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(), // throws if auth tag verification fails
      ]);

      return decrypted.toString('utf8');
    } catch (err: any) {
      // Re-throw with a cleaner message — the original crypto error can be verbose.
      throw new Error(
        `Failed to decrypt Paystack key: ${err?.message ?? 'authentication tag mismatch'}`,
      );
    }
  }

  /**
   * Returns whether a stored value is in the encrypted envelope format.
   * Used to decide whether to attempt decryption or treat the value as plaintext.
   */
  isEncrypted(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }
    // Must match `<version>:<24-hex>:<32-hex>:<hex+>` 
    return /^1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/.test(value);
  }
}
