import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

async function hasColumn(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
  const result = await queryRunner.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return result.length > 0;
}

export class AddBillingAndComplianceFieldsToOrganizations1743702000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await hasColumn(queryRunner, 'organizations', 'billing_plan_tier')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'billing_plan_tier',
          type: 'varchar',
          default: "'free'",
        }),
      );
    }

    if (!await hasColumn(queryRunner, 'organizations', 'data_retention_contact_days')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'data_retention_contact_days',
          type: 'integer',
          isNullable: true,
          default: 1095,
        }),
      );
    }

    if (!await hasColumn(queryRunner, 'organizations', 'data_retention_submission_days')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'data_retention_submission_days',
          type: 'integer',
          isNullable: true,
          default: 2555,
        }),
      );
    }

    if (!await hasColumn(queryRunner, 'organizations', 'data_retention_audit_days')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'data_retention_audit_days',
          type: 'integer',
          isNullable: true,
          default: 2555,
        }),
      );
    }

    if (!await hasColumn(queryRunner, 'organizations', 'auto_purge_retention_enabled')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'auto_purge_retention_enabled',
          type: 'boolean',
          default: true,
        }),
      );
    }

    if (!await hasColumn(queryRunner, 'organizations', 'last_data_retention_purge_at')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'last_data_retention_purge_at',
          type: 'timestamp',
          isNullable: true,
          default: null,
        }),
      );
    }

    // Add index if it doesn't already exist
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_organizations_billing_plan ON organizations(billing_plan_tier)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IDX_organizations_billing_plan`);
    await queryRunner.dropColumn('organizations', 'last_data_retention_purge_at');
    await queryRunner.dropColumn('organizations', 'auto_purge_retention_enabled');
    await queryRunner.dropColumn('organizations', 'data_retention_audit_days');
    await queryRunner.dropColumn('organizations', 'data_retention_submission_days');
    await queryRunner.dropColumn('organizations', 'data_retention_contact_days');
    await queryRunner.dropColumn('organizations', 'billing_plan_tier');
  }
}
