import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class ExpandContactFields1743564000000 implements MigrationInterface {
  name = 'ExpandContactFields1743564000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new contact fields for expanded profile support
    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'first_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'middle_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'last_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'gender',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'student_id',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'guardian_name',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'guardian_email',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'guardian_phone',
        type: 'varchar',
        isNullable: true,
      }),
    );

    // Make email nullable to support contacts created with only names
    const contactTable = await queryRunner.getTable('contacts');
    const emailColumn = contactTable?.findColumnByName('email');
    if (emailColumn && !emailColumn.isNullable) {
      await queryRunner.changeColumn(
        'contacts',
        emailColumn,
        new TableColumn({
          name: 'email',
          type: 'varchar',
          isNullable: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert email to non-nullable
    const contactTable = await queryRunner.getTable('contacts');
    const emailColumn = contactTable?.findColumnByName('email');
    if (emailColumn && emailColumn.isNullable) {
      await queryRunner.changeColumn(
        'contacts',
        emailColumn,
        new TableColumn({
          name: 'email',
          type: 'varchar',
          isNullable: false,
        }),
      );
    }

    // Drop new columns in reverse order
    await this.dropColumnIfExists(queryRunner, 'contacts', 'guardian_phone');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'guardian_email');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'guardian_name');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'student_id');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'gender');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'last_name');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'middle_name');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'first_name');
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
