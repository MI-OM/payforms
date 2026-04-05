import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentPartialAndOrgLimitFields1743700000000 implements MigrationInterface {
  name = 'AddPaymentPartialAndOrgLimitFields1743700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'allow_partial',
        type: 'boolean',
        default: false,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'payments',
      new TableColumn({
        name: 'total_amount',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'payments',
      new TableColumn({
        name: 'amount_paid',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'payments',
      new TableColumn({
        name: 'balance_due',
        type: 'decimal',
        precision: 10,
        scale: 2,
        default: 0,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'organizations',
      new TableColumn({
        name: 'partial_payment_limit',
        type: 'decimal',
        precision: 10,
        scale: 2,
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'organizations', 'partial_payment_limit');
    await this.dropColumnIfExists(queryRunner, 'payments', 'balance_due');
    await this.dropColumnIfExists(queryRunner, 'payments', 'amount_paid');
    await this.dropColumnIfExists(queryRunner, 'payments', 'total_amount');
    await this.dropColumnIfExists(queryRunner, 'forms', 'allow_partial');
  }

  private async addColumnIfMissing(queryRunner: QueryRunner, tableName: string, column: TableColumn) {
    const hasColumn = await queryRunner.hasColumn(tableName, column.name);
    if (!hasColumn) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfExists(queryRunner: QueryRunner, tableName: string, columnName: string) {
    const hasColumn = await queryRunner.hasColumn(tableName, columnName);
    if (hasColumn) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }
}
