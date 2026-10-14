import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables *strict* tenant isolation for the tables that already had permissive
 * RLS policies created by `AddRLSPolicies1777200000000`.
 *
 * The previous policies were effectively inert: they allowed every row whenever
 * `app.current_org_id` was unset or empty, and nothing in the application ever
 * set it. This migration:
 *
 *   1. Replaces the permissive policies with policies that only expose rows
 *      belonging to the current organization (`app.current_org_id`).
 *   2. Grants an explicit, auditable escape hatch to trusted system code paths
 *      (public endpoints, webhooks, authentication bootstrap, migrations) via
 *      the `app.rls_bypass` setting — instead of the accidental "unset means
 *      allow everything" behaviour.
 *   3. Forces Row Level Security so the policies also apply to the table owner
 *      (the database role the application connects as).
 *
 * The application sets both settings on the connection before every statement
 * (see `RlsQueryRunnerPatcher`), deriving them from the authenticated request.
 */
export class EnforceRLSPolicies1777300000000 implements MigrationInterface {
  name = 'EnforceRLSPolicies1777300000000';

  private readonly directTables = [
    'users',
    'contacts',
    'groups',
    'forms',
    'activity_logs',
    'payments',
    'payment_logs',
    'submissions',
    'internal_notifications',
    'contact_notifications',
    'reconciliation_runs',
    'reconciliation_exceptions',
    'payment_recovery_events',
    'payment_recovery_candidates',
    'partners',
    'partner_tenants',
    'integration_endpoints',
    'integration_deliveries',
    'installment_plans',
    'dunning_campaigns',
    'contact_installment_accounts',
    'compliance_export_jobs',
    'compliance_export_artifacts',
    'checkout_sessions',
    'contact_imports',
    'invitations',
  ];

  private readonly childTables: {
    table: string;
    parentTable: string;
    fkColumn: string;
  }[] = [
    { table: 'form_fields', parentTable: 'forms', fkColumn: 'form_id' },
    { table: 'form_targets', parentTable: 'forms', fkColumn: 'form_id' },
    {
      table: 'installment_plan_items',
      parentTable: 'installment_plans',
      fkColumn: 'plan_id',
    },
    {
      table: 'dunning_runs',
      parentTable: 'dunning_campaigns',
      fkColumn: 'campaign_id',
    },
  ];

  /** Escape hatch for trusted system contexts. Empty/unset means "no bypass". */
  private readonly bypass = `current_setting('app.rls_bypass', true) = 'on'`;

  /** Matches only the caller's organization; empty/unset denies everything. */
  private readonly orgMatch = `organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of this.directTables) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "${table}_org_isolation" ON "${table}"
        FOR ALL
        USING (${this.bypass} OR ${this.orgMatch})
        WITH CHECK (${this.bypass} OR ${this.orgMatch})
      `);
    }

    for (const { table, parentTable, fkColumn } of this.childTables) {
      if (
        !(await queryRunner.hasTable(table)) ||
        !(await queryRunner.hasTable(parentTable))
      ) {
        continue;
      }

      const parentMatch = `${fkColumn} IN (
        SELECT parent.id FROM "${parentTable}" parent
        WHERE parent.organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')
      )`;

      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "${table}_org_isolation" ON "${table}"
        FOR ALL
        USING (${this.bypass} OR ${parentMatch})
        WITH CHECK (${this.bypass} OR ${parentMatch})
      `);
    }

    if (await queryRunner.hasTable('arrears_snapshots')) {
      const arrearsMatch = `run_id IN (
        SELECT dr.id FROM "dunning_runs" dr
        INNER JOIN "dunning_campaigns" dc ON dc.id = dr.campaign_id
        WHERE dc.organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')
      )`;

      await queryRunner.query(`ALTER TABLE "arrears_snapshots" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "arrears_snapshots" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `DROP POLICY IF EXISTS "arrears_snapshots_org_isolation" ON "arrears_snapshots"`,
      );
      await queryRunner.query(`
        CREATE POLICY "arrears_snapshots_org_isolation" ON "arrears_snapshots"
        FOR ALL
        USING (${this.bypass} OR ${arrearsMatch})
        WITH CHECK (${this.bypass} OR ${arrearsMatch})
      `);
    }

    for (const table of ['contact_groups', 'form_groups']) {
      if (!(await queryRunner.hasTable(table)) || !(await queryRunner.hasTable('groups'))) {
        continue;
      }

      const groupMatch = `group_id IN (
        SELECT g.id FROM "groups" g
        WHERE g.organization_id::text = NULLIF(current_setting('app.current_org_id', true), '')
      )`;

      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "${table}_org_isolation" ON "${table}"
        FOR ALL
        USING (${this.bypass} OR ${groupMatch})
        WITH CHECK (${this.bypass} OR ${groupMatch})
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const permissive = (table: string) => `
      CREATE POLICY "${table}_org_isolation" ON "${table}"
      FOR ALL
      USING (
        organization_id::text = current_setting('app.current_org_id', true)
        OR current_setting('app.current_org_id', true) IS NULL
        OR current_setting('app.current_org_id', true) = ''
      )
      WITH CHECK (
        organization_id::text = current_setting('app.current_org_id', true)
        OR current_setting('app.current_org_id', true) IS NULL
        OR current_setting('app.current_org_id', true) = ''
      )
    `;

    for (const table of this.directTables) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(permissive(table));
    }

    // Child and join tables are restored to "deny when no context, otherwise
    // delegated to the parent" semantics by simply disabling enforcement; the
    // exact legacy permissive bodies are restored for the leaf tables below.
    for (const { table, parentTable, fkColumn } of this.childTables) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "${table}_org_isolation" ON "${table}"
        FOR ALL
        USING (
          ${fkColumn} IN (
            SELECT parent.id FROM "${parentTable}" parent
            WHERE parent.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
        WITH CHECK (
          ${fkColumn} IN (
            SELECT parent.id FROM "${parentTable}" parent
            WHERE parent.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
      `);
    }

    if (await queryRunner.hasTable('arrears_snapshots')) {
      await queryRunner.query(`ALTER TABLE "arrears_snapshots" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(
        `DROP POLICY IF EXISTS "arrears_snapshots_org_isolation" ON "arrears_snapshots"`,
      );
      await queryRunner.query(`
        CREATE POLICY "arrears_snapshots_org_isolation" ON "arrears_snapshots"
        FOR ALL
        USING (
          run_id IN (
            SELECT dr.id FROM "dunning_runs" dr
            INNER JOIN "dunning_campaigns" dc ON dc.id = dr.campaign_id
            WHERE dc.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
        WITH CHECK (
          run_id IN (
            SELECT dr.id FROM "dunning_runs" dr
            INNER JOIN "dunning_campaigns" dc ON dc.id = dr.campaign_id
            WHERE dc.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
      `);
    }

    for (const table of ['contact_groups', 'form_groups']) {
      if (!(await queryRunner.hasTable(table))) {
        continue;
      }
      await queryRunner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`
        CREATE POLICY "${table}_org_isolation" ON "${table}"
        FOR ALL
        USING (
          group_id IN (
            SELECT g.id FROM "groups" g
            WHERE g.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
        WITH CHECK (
          group_id IN (
            SELECT g.id FROM "groups" g
            WHERE g.organization_id::text = current_setting('app.current_org_id', true)
          )
          OR current_setting('app.current_org_id', true) IS NULL
          OR current_setting('app.current_org_id', true) = ''
        )
      `);
    }
  }
}
