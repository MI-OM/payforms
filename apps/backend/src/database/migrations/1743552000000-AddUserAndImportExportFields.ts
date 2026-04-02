import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddUserAndImportExportFields1743552000000 implements MigrationInterface {
  name = 'AddUserAndImportExportFields1743552000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'title',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'designation',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'invitations',
      new TableColumn({
        name: 'title',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'invitations',
      new TableColumn({
        name: 'designation',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'groups',
      new TableColumn({
        name: 'description',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'groups',
      new TableColumn({
        name: 'note',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'description',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'forms',
      new TableColumn({
        name: 'note',
        type: 'varchar',
        isNullable: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await this.dropColumnIfExists(queryRunner, 'forms', 'note');
    await this.dropColumnIfExists(queryRunner, 'forms', 'description');
    await this.dropColumnIfExists(queryRunner, 'groups', 'note');
    await this.dropColumnIfExists(queryRunner, 'groups', 'description');
    await this.dropColumnIfExists(queryRunner, 'invitations', 'designation');
    await this.dropColumnIfExists(queryRunner, 'invitations', 'title');
    await this.dropColumnIfExists(queryRunner, 'users', 'designation');
    await this.dropColumnIfExists(queryRunner, 'users', 'title');
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
