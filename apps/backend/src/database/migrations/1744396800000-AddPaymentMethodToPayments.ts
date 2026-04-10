import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaymentMethodToPayments1744396800000 implements MigrationInterface {
  name = 'AddPaymentMethodToPayments1744396800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('payments', 'payment_method');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'payments',
        new TableColumn({
          name: 'payment_method',
          type: 'varchar',
          default: `'ONLINE'`,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('payments', 'payment_method');
    if (hasColumn) {
      await queryRunner.dropColumn('payments', 'payment_method');
    }
  }
}
