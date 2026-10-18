import { MigrationInterface, QueryRunner } from 'typeorm';
import * as crypto from 'crypto';

/**
 * Backfill migration: encrypts any plaintext `paystack_secret_key` values that
 * are already in the `organizations` table.
 *
 * This migration uses AES-256-GCM (the same algorithm as
 * `PaystackKeyEncryptionService`) and reads the encryption key from the
 * `PAYSTACK_KEY_ENCRYPTION_KEY` environment variable.
 *
 * PRE-CONDITIONS:
 *   1. `PAYSTACK_KEY_ENCRYPTION_KEY` must be set to a 64-char hex string in the
 *      Render (or local) environment BEFORE running this migration.
 *      Generate: `openssl rand -hex 32`
 *   2. Back up the database (Supabase PITR snapshot) before running.
 *   3. The migration is idempotent: rows whose value already looks like an
 *      encrypted envelope (matches `1:<24hex>:<32hex>:<hex+>`) are skipped.
 *
 * ROLLBACK (`down`):
 *   Decrypts all encrypted values and restores plaintext — requires the SAME
 *   `PAYSTACK_KEY_ENCRYPTION_KEY` that was used to encrypt.
 *
 * If `PAYSTACK_KEY_ENCRYPTION_KEY` is not set, the migration logs a prominent
 * warning and exits without modifying any data. Set the key and re-run.
 */
export class EncryptPaystackSecretKeys1778100000000 implements MigrationInterface {
  name = 'EncryptPaystackSecretKeys1778100000000';

  private readonly ALGORITHM = 'aes-256-gcm' as const;
  private readonly IV_BYTES = 12;
  private readonly VERSION = '1';
  private readonly ENCRYPTED_PATTERN = /^1:[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/;

  private loadKey(): Buffer | null {
    const raw = process.env.PAYSTACK_KEY_ENCRYPTION_KEY;
    if (!raw?.trim()) {
      console.warn(
        '[EncryptPaystackSecretKeys] PAYSTACK_KEY_ENCRYPTION_KEY is not set. ' +
        'Skipping encryption migration — no keys will be encrypted. ' +
        'Set the variable and re-run this migration to encrypt existing keys.',
      );
      return null;
    }
    const hex = raw.trim().toLowerCase();
    if (!/^[0-9a-f]{64}$/.test(hex)) {
      throw new Error(
        'PAYSTACK_KEY_ENCRYPTION_KEY must be exactly 64 hex characters. ' +
        'Generate one with: openssl rand -hex 32',
      );
    }
    return Buffer.from(hex, 'hex');
  }

  private encrypt(plaintext: string, keyBuffer: Buffer): string {
    const iv = crypto.randomBytes(this.IV_BYTES);
    const cipher = crypto.createCipheriv(this.ALGORITHM, keyBuffer, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [this.VERSION, iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':');
  }

  private decrypt(stored: string, keyBuffer: Buffer): string {
    const [, ivHex, tagHex, ciphertextHex] = stored.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher = crypto.createDecipheriv(this.ALGORITHM, keyBuffer, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    const keyBuffer = this.loadKey();
    if (!keyBuffer) {
      return; // skip gracefully
    }

    const rows: Array<{ id: string; paystack_secret_key: string }> =
      await queryRunner.query(
        `SELECT id, paystack_secret_key FROM organizations WHERE paystack_secret_key IS NOT NULL`,
      );

    let encrypted = 0;
    let skipped = 0;

    for (const row of rows) {
      if (this.ENCRYPTED_PATTERN.test(row.paystack_secret_key)) {
        skipped++;
        continue; // already encrypted — idempotent
      }

      const ciphertext = this.encrypt(row.paystack_secret_key, keyBuffer);
      await queryRunner.query(
        `UPDATE organizations SET paystack_secret_key = $1 WHERE id = $2`,
        [ciphertext, row.id],
      );
      encrypted++;
    }

    console.log(
      `[EncryptPaystackSecretKeys] Encrypted ${encrypted} key(s), skipped ${skipped} already-encrypted key(s).`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const keyBuffer = this.loadKey();
    if (!keyBuffer) {
      console.warn(
        '[EncryptPaystackSecretKeys] Cannot decrypt during rollback: PAYSTACK_KEY_ENCRYPTION_KEY is not set.',
      );
      return;
    }

    const rows: Array<{ id: string; paystack_secret_key: string }> =
      await queryRunner.query(
        `SELECT id, paystack_secret_key FROM organizations WHERE paystack_secret_key IS NOT NULL`,
      );

    let decrypted = 0;
    for (const row of rows) {
      if (!this.ENCRYPTED_PATTERN.test(row.paystack_secret_key)) {
        continue; // already plaintext
      }
      const plaintext = this.decrypt(row.paystack_secret_key, keyBuffer);
      await queryRunner.query(
        `UPDATE organizations SET paystack_secret_key = $1 WHERE id = $2`,
        [plaintext, row.id],
      );
      decrypted++;
    }

    console.log(`[EncryptPaystackSecretKeys] Rolled back: decrypted ${decrypted} key(s).`);
  }
}
