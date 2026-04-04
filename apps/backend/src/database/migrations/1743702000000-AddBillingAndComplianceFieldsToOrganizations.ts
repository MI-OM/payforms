import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddBillingAndComplianceFieldsToOrganizations1743702000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'billing_plan_tier',
        type: 'varchar',
        default: "'free'",
      }),
    );

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'data_retention_contact_days',
        type: 'integer',
        isNullable: true,
        default: 1095,
      }),
    );

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'data_retention_submission_days',
        type: 'integer',
        isNullable: true,
        default: 2555,
      }),
    );

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'data_retention_audit_days',
        type: 'integer',
        isNullable: true,
        default: 2555,
      }),
    );

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'auto_purge_retention_enabled',
        type: 'boolean',
        default: true,
      }),
    );

    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'last_data_retention_purge_at',
        type: 'timestamp',
        isNullable: true,
        default: null,
      }),
    );

    // Add indexes for efficient queries
    await queryRunner.query(
      `CREATE INDEX IDX_organizations_billing_plan ON organizations(billing_plan_tier)`,
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
