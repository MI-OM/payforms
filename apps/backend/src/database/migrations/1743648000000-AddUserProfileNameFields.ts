import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserProfileNameFields1743648000000 implements MigrationInterface {
  name = 'AddUserProfileNameFields1743648000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'first_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'middle_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'last_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'invitations',
      new TableColumn({
        name: 'first_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'invitations',
      new TableColumn({
        name: 'last_name',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'invitations', 'last_name');
    await this.dropColumnIfExists(queryRunner, 'invitations', 'first_name');
    await this.dropColumnIfExists(queryRunner, 'users', 'last_name');
    await this.dropColumnIfExists(queryRunner, 'users', 'middle_name');
    await this.dropColumnIfExists(queryRunner, 'users', 'first_name');
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
