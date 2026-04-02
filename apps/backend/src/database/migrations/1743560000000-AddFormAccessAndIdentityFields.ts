import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddFormAccessAndIdentityFields1743560000000 implements MigrationInterface {
  name = 'AddFormAccessAndIdentityFields1743560000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'access_mode',
        type: 'varchar',
        enum: ['OPEN', 'LOGIN_REQUIRED', 'TARGETED_ONLY'],
        default: "'OPEN'",
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'identity_validation_mode',
        type: 'varchar',
        enum: ['NONE', 'CONTACT_EMAIL', 'CONTACT_EXTERNAL_ID'],
        default: "'NONE'",
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'identity_field_label',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'forms', 'identity_field_label');
    await this.dropColumnIfExists(queryRunner, 'forms', 'identity_validation_mode');
    await this.dropColumnIfExists(queryRunner, 'forms', 'access_mode');
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
