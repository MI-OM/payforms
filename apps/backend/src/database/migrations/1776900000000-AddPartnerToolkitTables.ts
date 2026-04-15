import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPartnerToolkitTables1776900000000 implements MigrationInterface {
  name = 'AddPartnerToolkitTables1776900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partners" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "config" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partners_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_partners_org_created"
      ON "partners" ("organization_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "partner_tenants" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "partner_id" uuid NOT NULL,
        "tenant_organization_id" uuid NOT NULL,
        "onboarding_status" character varying NOT NULL DEFAULT 'PENDING',
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_partner_tenants_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_partner_tenants_partner_tenant_org" UNIQUE ("partner_id", "tenant_organization_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_partner_tenants_partner_created"
      ON "partner_tenants" ("partner_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_partner_tenants_org_status"
      ON "partner_tenants" ("organization_id", "onboarding_status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_partner_tenants_org_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_partner_tenants_partner_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "partner_tenants"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_partners_org_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "partners"');
  }
}