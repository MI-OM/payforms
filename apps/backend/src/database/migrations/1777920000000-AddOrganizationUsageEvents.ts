import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Usage ledger for email sends and storage bytes (see
 * `OrganizationUsageEvent`). Additive and idempotent.
 *
 * These metrics have no natural tenant table to count, so without this ledger
 * the `monthly_email_sends` and `storage_gb` plan limits could never be
 * enforced or reported accurately.
 *
 * The table IS organization-scoped, so it gets the same strict tenant RLS
 * policy as the other tenant tables in `EnforceRLSPolicies1777300000000`:
 * rows are visible when the caller's `app.current_org_id` matches, or when
 * trusted system code sets `app.rls_bypass=on` (public submissions, webhooks,
 * migrations). Billing reads/writes happen inside authenticated tenant requests
 * or bypassed system contexts, so both paths are covered.
 */
export class AddOrganizationUsageEvents1777920000000 implements MigrationInterface {
  name = 'AddOrganizationUsageEvents1777920000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organization_usage_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "metric" character varying(40) NOT NULL,
        "amount" bigint NOT NULL,
        "note" character varying(200),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organization_usage_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_org_usage_events_org_metric_created" ON "organization_usage_events" ("organization_id", "metric", "created_at")',
    );

    const bypass = `current_setting('app.rls_bypass', true) = 'on'`;
    const orgMatch = `organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')`;

    await queryRunner.query('ALTER TABLE "organization_usage_events" ENABLE ROW LEVEL SECURITY');
    await queryRunner.query('ALTER TABLE "organization_usage_events" FORCE ROW LEVEL SECURITY');
    await queryRunner.query(
      'DROP POLICY IF EXISTS "organization_usage_events_org_isolation" ON "organization_usage_events"',
    );
    await queryRunner.query(`
      CREATE POLICY "organization_usage_events_org_isolation" ON "organization_usage_events"
      FOR ALL
      USING (${bypass} OR ${orgMatch})
      WITH CHECK (${bypass} OR ${orgMatch})
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP POLICY IF EXISTS "organization_usage_events_org_isolation" ON "organization_usage_events"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_org_usage_events_org_metric_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "organization_usage_events"');
  }
}
