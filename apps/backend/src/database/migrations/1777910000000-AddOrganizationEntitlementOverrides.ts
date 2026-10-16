import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Manual per-organization entitlement overrides (Part 3, Module 8).
 *
 * Interim control-plane tool: platform operators set an organization's real
 * limits (contacts, forms, staff seats, submissions, emails, storage) from the
 * console while full billing (Part 1) is being decided. One row per
 * organization; NULL columns inherit the plan defaults.
 *
 * Control-plane table — NOT added to the tenant RLS policy set (see
 * `EnforceRLSPolicies1777300000000`). Purely additive and idempotent.
 */
export class AddOrganizationEntitlementOverrides1777910000000 implements MigrationInterface {
  name = 'AddOrganizationEntitlementOverrides1777910000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_entitlement_overrides" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "contacts_limit" integer,
        "forms_limit" integer,
        "staff_users_limit" integer,
        "monthly_submissions_limit" integer,
        "monthly_email_sends_limit" integer,
        "storage_gb_limit" integer,
        "notes" character varying(500),
        "set_by_platform_user_id" uuid,
        "set_by_email" character varying(320),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_entitlement_overrides_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_org_entitlement_overrides_org_unique" ON "organization_entitlement_overrides" ("organization_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_org_entitlement_overrides_org_unique"');
    await queryRunner.query('DROP TABLE IF EXISTS "organization_entitlement_overrides"');
  }
}
