import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddEnabledPaymentMethodsToOrganizations1776200000000 implements MigrationInterface {
  name = 'AddEnabledPaymentMethodsToOrganizations1776200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('organizations', 'enabled_payment_methods');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'enabled_payment_methods',
          type: 'varchar',
          isArray: true,
          isNullable: false,
          default: "ARRAY['ONLINE']::varchar[]",
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('organizations', 'enabled_payment_methods');
    if (hasColumn) {
      await queryRunner.dropColumn('organizations', 'enabled_payment_methods');
    }
  }
}