import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddPaystackWebhookUrlToOrganization1743704000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.addColumn(
      'organizations',
      new TableColumn({
        name: 'paystack_webhook_url',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropColumn('organizations', 'paystack_webhook_url');
  }
}