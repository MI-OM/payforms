import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seed the platform control-plane defaults (Part 3, Wave A, Module 5).
 *
 * The console's Settings and Feature Flags screens read from
 * `platform_settings` / `platform_feature_flags`, which migrations left empty —
 * production tables started blank while the mock carried five settings and
 * three flags. This inserts those same globals so a fresh environment shows a
 * populated console instead of empty lists.
 *
 * Idempotent: every insert is ON CONFLICT (key) DO NOTHING, so operator edits
 * made through the console are never overwritten on re-run.
 *
 * Control-plane tables — NOT part of the tenant RLS policy set.
 */
export class SeedPlatformSettingsAndFlags1777930000000 implements MigrationInterface {
  name = 'SeedPlatformSettingsAndFlags1777930000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const settings: Array<{
      key: string;
      value: unknown;
      value_type: string;
      category: string;
      description: string;
      is_secret: boolean;
    }> = [
      {
        key: 'maintenance_mode',
        value: false,
        value_type: 'boolean',
        category: 'GENERAL',
        description: 'Globally blocks tenant logins and public forms while enabled',
        is_secret: false,
      },
      {
        key: 'support_email',
        value: 'support@payforms.com.ng',
        value_type: 'string',
        category: 'GENERAL',
        description: 'Reply-to address used on platform notifications',
        is_secret: false,
      },
      {
        key: 'default_email_provider',
        value: 'mailgun',
        value_type: 'string',
        category: 'INTEGRATIONS',
        description: 'Provider used when an organization has none configured',
        is_secret: false,
      },
      {
        key: 'platform_paystack_secret_key',
        value: null,
        value_type: 'string',
        category: 'PAYMENTS',
        description: 'Platform-owned Paystack secret (Part 1 billing)',
        is_secret: true,
      },
      {
        key: 'max_upload_mb',
        value: 25,
        value_type: 'number',
        category: 'GENERAL',
        description: 'Maximum file upload size for form attachments',
        is_secret: false,
      },
    ];

    for (const setting of settings) {
      await queryRunner.query(
        `INSERT INTO "platform_settings"
           ("key", "value", "value_type", "category", "description", "is_secret")
         VALUES ($1, $2::jsonb, $3, $4, $5, $6)
         ON CONFLICT ("key") DO NOTHING`,
        [
          setting.key,
          JSON.stringify(setting.value),
          setting.value_type,
          setting.category,
          setting.description,
          setting.is_secret,
        ],
      );
    }

    const flags: Array<{ key: string; description: string; enabled: boolean }> = [
      {
        key: 'impersonation',
        description: 'Opt-out kill switch for platform impersonation sessions',
        enabled: true,
      },
      {
        key: 'inline_checkout',
        description: 'Paystack inline/popup checkout instead of redirect',
        enabled: false,
      },
      {
        key: 'offline_payments',
        description: 'Opt-in offline CASH/POS payment capture per organization',
        enabled: true,
      },
    ];

    for (const flag of flags) {
      await queryRunner.query(
        `INSERT INTO "platform_feature_flags" ("key", "description", "enabled")
         VALUES ($1, $2, $3)
         ON CONFLICT ("key") DO NOTHING`,
        [flag.key, flag.description, flag.enabled],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Only remove rows still at their seeded defaults so operator changes survive.
    await queryRunner.query(
      `DELETE FROM "platform_settings"
       WHERE ("key", value, value_type, category) IN (
         ('maintenance_mode', 'false'::jsonb, 'boolean', 'GENERAL'),
         ('support_email', '"support@payforms.com.ng"'::jsonb, 'string', 'GENERAL'),
         ('default_email_provider', '"mailgun"'::jsonb, 'string', 'INTEGRATIONS'),
         ('platform_paystack_secret_key', 'null'::jsonb, 'string', 'PAYMENTS'),
         ('max_upload_mb', '25'::jsonb, 'number', 'GENERAL')
       )`,
    );
    await queryRunner.query(
      `DELETE FROM "platform_feature_flags"
       WHERE ("key", "enabled", "description") IN (
         ('impersonation', true, 'Opt-out kill switch for platform impersonation sessions'),
         ('inline_checkout', false, 'Paystack inline/popup checkout instead of redirect'),
         ('offline_payments', true, 'Opt-in offline CASH/POS payment capture per organization')
       )`,
    );
  }
}
