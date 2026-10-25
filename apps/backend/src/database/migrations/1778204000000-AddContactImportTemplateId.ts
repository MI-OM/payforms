import { MigrationInterface, QueryRunner, TableColumn, TableIndex, TableForeignKey } from 'typeorm';

/**
 * Links a contact import job to the import template that was used to run it.
 *
 * Until now the link only existed on `contact_import_job_applications`, which is
 * written by the audit-trail recorder. Nothing on the import job itself pointed
 * back at the template, so `GET /contacts/imports/:id` could not tell you which
 * template produced it without a second lookup, and the import list could not
 * filter by template.
 *
 * The column is nullable: imports that predate templates (and imports run with
 * the built-in system default) have no template to point at.
 */
export class AddContactImportTemplateId1778204000000 implements MigrationInterface {
  name = 'AddContactImportTemplateId1778204000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contact_imports');
    if (!table) {
      return;
    }

    const columnExists = table.columns.some((col) => col.name === 'template_id');
    if (!columnExists) {
      await queryRunner.addColumn(
        'contact_imports',
        new TableColumn({
          name: 'template_id',
          type: 'uuid',
          isNullable: true,
          comment: 'Import template used for this job; NULL when the system default was used',
        }),
      );
    }

    // Backfill from the audit trail where a snapshot was already recorded, so
    // existing history links up with the template it was actually run against.
    await queryRunner.query(`
      UPDATE "contact_imports" ci
      SET "template_id" = app."template_id"
      FROM "contact_import_job_applications" app
      WHERE app."import_job_id" = ci."id"
        AND ci."template_id" IS NULL
        AND app."template_id" IS NOT NULL
    `);

    const foreignKeyExists = table.foreignKeys.some((fk) =>
      fk.columnNames.includes('template_id'),
    );
    if (!foreignKeyExists) {
      await queryRunner.createForeignKey(
        'contact_imports',
        new TableForeignKey({
          columnNames: ['template_id'],
          referencedTableName: 'contact_import_templates',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );
    }

    const refreshedTable = await queryRunner.getTable('contact_imports');
    const indexExists = refreshedTable?.indices.some(
      (index) => index.name === 'IDX_contact_imports_template_id',
    );
    if (!indexExists) {
      await queryRunner.createIndex(
        'contact_imports',
        new TableIndex({
          name: 'IDX_contact_imports_template_id',
          columnNames: ['template_id'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contact_imports');
    if (!table) {
      return;
    }

    const foreignKey = table.foreignKeys.find((fk) => fk.columnNames.includes('template_id'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('contact_imports', foreignKey);
    }

    await queryRunner.dropIndex('contact_imports', 'IDX_contact_imports_template_id');

    if (table.columns.some((col) => col.name === 'template_id')) {
      await queryRunner.dropColumn('contact_imports', 'template_id');
    }
  }
}
