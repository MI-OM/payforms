import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRLSPolicies1777200000000 implements MigrationInterface {
  name = 'AddRLSPolicies1777200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const directTables = [
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

    for (const table of directTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

      await queryRunner.query(`
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
      `);
    }

    // Child tables without their own organization_id column: resolve the org
    // through their parent table instead.
    const childTables: { table: string; parentTable: string; fkColumn: string }[] = [
      { table: 'form_fields', parentTable: 'forms', fkColumn: 'form_id' },
      { table: 'form_targets', parentTable: 'forms', fkColumn: 'form_id' },
      { table: 'installment_plan_items', parentTable: 'installment_plans', fkColumn: 'plan_id' },
      { table: 'dunning_runs', parentTable: 'dunning_campaigns', fkColumn: 'campaign_id' },
    ];

    for (const { table, parentTable, fkColumn } of childTables) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);

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

    // arrears_snapshots is two levels deep: run -> dunning_runs -> dunning_campaigns.
    await queryRunner.query(`ALTER TABLE "arrears_snapshots" ENABLE ROW LEVEL SECURITY`);
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

    await queryRunner.query(`ALTER TABLE "contact_groups" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "contact_groups_org_isolation" ON "contact_groups"
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

    await queryRunner.query(`ALTER TABLE "form_groups" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "form_groups_org_isolation" ON "form_groups"
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

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_app_current_org_id()
      RETURNS void AS $$
      BEGIN
        IF current_setting('app.current_org_id', true) IS NULL OR current_setting('app.current_org_id', true) = '' THEN
          PERFORM set_config('app.current_org_id', '', true);
        END IF;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);

    await queryRunner.query(`COMMENT ON FUNCTION set_app_current_org_id() IS 'Initialize app.current_org_id setting to empty string if not set'`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'users',
      'contacts',
      'groups',
      'form_fields',
      'form_targets',
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
      'installment_plan_items',
      'dunning_campaigns',
      'arrears_snapshots',
      'dunning_runs',
      'contact_installment_accounts',
      'compliance_export_jobs',
      'compliance_export_artifacts',
      'checkout_sessions',
      'contact_imports',
      'invitations',
      'contact_groups',
      'form_groups',
    ];

    for (const table of tables) {
      await queryRunner.query(`DROP POLICY IF EXISTS "${table}_org_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }

    await queryRunner.query(`DROP FUNCTION IF EXISTS set_app_current_org_id()`);
  }
}