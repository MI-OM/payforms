import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserTwoFactorFields1744310400000 implements MigrationInterface {
  name = 'AddUserTwoFactorFields1744310400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN IF NOT EXISTS "two_factor_enabled" boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS "two_factor_secret" text,
      ADD COLUMN IF NOT EXISTS "two_factor_temp_secret" text,
      ADD COLUMN IF NOT EXISTS "two_factor_temp_expires_at" TIMESTAMP,
      ADD COLUMN IF NOT EXISTS "two_factor_recovery_codes" text
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      DROP COLUMN IF EXISTS "two_factor_recovery_codes",
      DROP COLUMN IF EXISTS "two_factor_temp_expires_at",
      DROP COLUMN IF EXISTS "two_factor_temp_secret",
      DROP COLUMN IF EXISTS "two_factor_secret",
      DROP COLUMN IF EXISTS "two_factor_enabled"
    `);
  }
}