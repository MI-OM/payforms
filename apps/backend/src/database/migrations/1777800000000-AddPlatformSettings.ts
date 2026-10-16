import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform settings + feature flags (Part 3, Wave A, Module 5).
 *
 * - `platform_settings`  — typed global key/value configuration (provider keys
 *   live here under the INTEGRATIONS/PAYMENTS categories).
 * - `platform_feature_flags` — named booleans with a global default.
 * - `platform_feature_flag_overrides` — optional per-organization override.
 *
 * All three are control-plane tables and are intentionally NOT added to the
 * tenant RLS policy set (see `EnforceRLSPolicies1777300000000`): only platform
 * routes touch them.
 *
 * Purely additive and idempotent.
 */
export class AddPlatformSettings1777800000000 implements MigrationInterface {
  name = 'AddPlatformSettings1777800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_settings" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "value" jsonb,
        "value_type" character varying NOT NULL DEFAULT 'json',
        "category" character varying NOT NULL DEFAULT 'GENERAL',
        "description" character varying,
        "is_secret" boolean NOT NULL DEFAULT false,
        "updated_by_platform_user_id" uuid,
        "updated_by_email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_settings_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_settings_key" ON "platform_settings" ("key")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_settings_category" ON "platform_settings" ("category")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_feature_flags" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "key" character varying NOT NULL,
        "description" character varying,
        "enabled" boolean NOT NULL DEFAULT false,
        "metadata" jsonb,
        "updated_by_platform_user_id" uuid,
        "updated_by_email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_feature_flags_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_feature_flags_key" ON "platform_feature_flags" ("key")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_feature_flag_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "flag_key" character varying NOT NULL,
        "organization_id" uuid NOT NULL,
        "enabled" boolean NOT NULL,
        "reason" character varying,
        "updated_by_platform_user_id" uuid,
        "updated_by_email" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_feature_flag_overrides_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_feature_flag_overrides_flag_org" ON "platform_feature_flag_overrides" ("flag_key", "organization_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_feature_flag_overrides_org" ON "platform_feature_flag_overrides" ("organization_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_feature_flag_overrides_org"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_platform_feature_flag_overrides_flag_org"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "platform_feature_flag_overrides"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_feature_flags_key"');
    await queryRunner.query('DROP TABLE IF EXISTS "platform_feature_flags"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_settings_category"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_settings_key"');
    await queryRunner.query('DROP TABLE IF EXISTS "platform_settings"');
  }
}
