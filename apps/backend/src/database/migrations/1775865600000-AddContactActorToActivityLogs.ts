import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddContactActorToActivityLogs1775865600000 implements MigrationInterface {
  name = 'AddContactActorToActivityLogs1775865600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasColumn = await queryRunner.hasColumn('activity_logs', 'contact_id');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'activity_logs',
        new TableColumn({
          name: 'contact_id',
          type: 'uuid',
          isNullable: true,
        }),
      );
    }

    const table = await queryRunner.getTable('activity_logs');
    const hasIndex = table?.indices.some(index => index.name === 'IDX_activity_logs_org_contact_id');
    if (!hasIndex) {
      await queryRunner.createIndex(
        'activity_logs',
        new TableIndex({
          name: 'IDX_activity_logs_org_contact_id',
          columnNames: ['organization_id', 'contact_id'],
        }),
      );
    }

    const hasForeignKey = table?.foreignKeys.some(fk => fk.name === 'FK_activity_logs_contact_id');
    if (!hasForeignKey) {
      await queryRunner.createForeignKey(
        'activity_logs',
        new TableForeignKey({
          name: 'FK_activity_logs_contact_id',
          columnNames: ['contact_id'],
          referencedTableName: 'contacts',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    await queryRunner.query(`
      UPDATE "activity_logs"
      SET "contact_id" = NULLIF("metadata"->'actor'->>'id', '')::uuid
      WHERE "contact_id" IS NULL
        AND COALESCE("metadata"->'actor'->>'role', '') = 'CONTACT'
        AND COALESCE("metadata"->'actor'->>'id', '') <> ''
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('activity_logs');
    const foreignKey = table?.foreignKeys.find(fk => fk.name === 'FK_activity_logs_contact_id');
    if (foreignKey) {
      await queryRunner.dropForeignKey('activity_logs', foreignKey);
    }

    const index = table?.indices.find(item => item.name === 'IDX_activity_logs_org_contact_id');
    if (index) {
      await queryRunner.dropIndex('activity_logs', index);
    }

    const hasColumn = await queryRunner.hasColumn('activity_logs', 'contact_id');
    if (hasColumn) {
      await queryRunner.dropColumn('activity_logs', 'contact_id');
    }
  }
}