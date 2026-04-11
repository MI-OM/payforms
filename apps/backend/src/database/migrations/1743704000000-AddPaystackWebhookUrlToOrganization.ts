import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

async function hasColumn(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
  const result = await queryRunner.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = $1 AND column_name = $2`,
    [table, column],
  );
  return result.length > 0;
}

export class AddPaystackWebhookUrlToOrganization1743704000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    if (!await hasColumn(queryRunner, 'organizations', 'paystack_webhook_url')) {
      await queryRunner.addColumn(
        'organizations',
        new TableColumn({
          name: 'paystack_webhook_url',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('organizations', 'paystack_webhook_url');
  }
}