import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Organization lifecycle status (Part 3, Wave A, Module 3).
 *
 * Adds the denormalised status columns used to enforce the platform "hard stop"
 * (suspended/disabled blocks tenant login and public payment forms) plus the
 * append-only `org_status_events` history table.
 *
 * Purely additive and idempotent: existing rows default to `active`, so no
 * organization is disrupted by running this migration.
 *
 * `org_status_events` is a control-plane table with an `organization_id` but is
 * intentionally NOT added to the tenant RLS policy set (see
 * `EnforceRLSPolicies1777300000000`): only platform admin routes touch it and
 * those run in a system context.
 */
export class AddOrganizationStatus1777600000000 implements MigrationInterface {
  name = 'AddOrganizationStatus1777600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status" character varying NOT NULL DEFAULT 'active'`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status_changed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "status_changed_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "organizations" ADD COLUMN IF NOT EXISTS "suspended_until" TIMESTAMP`,
    );

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_organizations_status" ON "organizations" ("status")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_status_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "previous_status" character varying NOT NULL,
        "new_status" character varying NOT NULL,
        "reason" text,
        "expires_at" TIMESTAMP,
        "actor_platform_user_id" uuid,
        "actor_email" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_org_status_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_org_status_events_org_created" ON "org_status_events" ("organization_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_org_status_events_status" ON "org_status_events" ("new_status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_org_status_events_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_org_status_events_org_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "org_status_events"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_organizations_status"');
    await queryRunner.query('ALTER TABLE "organizations" DROP COLUMN IF EXISTS "suspended_until"');
    await queryRunner.query('ALTER TABLE "organizations" DROP COLUMN IF EXISTS "status_changed_by"');
    await queryRunner.query('ALTER TABLE "organizations" DROP COLUMN IF EXISTS "status_changed_at"');
    await queryRunner.query('ALTER TABLE "organizations" DROP COLUMN IF EXISTS "status_reason"');
    await queryRunner.query('ALTER TABLE "organizations" DROP COLUMN IF EXISTS "status"');
  }
}
