import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketReadinessFlagsToOrganizations1776400000000 implements MigrationInterface {
  name = 'AddMarketReadinessFlagsToOrganizations1776400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN IF NOT EXISTS "market_readiness_flags" jsonb NOT NULL DEFAULT '{}'::jsonb
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP COLUMN IF EXISTS "market_readiness_flags"
    `);
  }
}
