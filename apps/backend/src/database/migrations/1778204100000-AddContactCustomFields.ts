import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Stores organization-defined custom contact field values.
 *
 * Import templates can define custom fields (e.g. "Academic Year", "House"),
 * and the import pipeline validates against them. Without a column to persist
 * the values, those fields were validated and then thrown away — the template
 * would claim the data was captured when it was not.
 *
 * The column holds a flat JSON object keyed by the template custom field id.
 */
export class AddContactCustomFields1778204100000 implements MigrationInterface {
  name = 'AddContactCustomFields1778204100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('contacts');
    if (!table) {
      return;
    }

    const columnExists = table.columns.some((col) => col.name === 'custom_fields');
    if (!columnExists) {
      await queryRunner.addColumn(
        'contacts',
        new TableColumn({
          name: 'custom_fields',
          type: 'jsonb',
          isNullable: true,
          default: "'{}'::jsonb",
          comment: 'Organization-defined custom field values, keyed by template custom field id',
        }),
      );
    }

    // The import audit trail is meant to hold exactly one row per import job.
    // Nothing enforced that, so a retried import could append a second row.
    // Collapse any existing duplicates (keeping the newest) before the unique
    // index goes on.
    await queryRunner.query(`
      DELETE FROM "contact_import_job_applications" older
      USING "contact_import_job_applications" newer
      WHERE older."import_job_id" = newer."import_job_id"
        AND (older."created_at", older."id") < (newer."created_at", newer."id")
    `);

    const applicationTable = await queryRunner.getTable('contact_import_job_applications');
    const hasUniqueIndex = applicationTable?.indices.some(
      (index) => index.name === 'IDX_contact_import_job_applications_import_job_unique',
    );
    if (!hasUniqueIndex) {
      await queryRunner.createIndex(
        'contact_import_job_applications',
        new TableIndex({
          name: 'IDX_contact_import_job_applications_import_job_unique',
          columnNames: ['import_job_id'],
          isUnique: true,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex(
      'contact_import_job_applications',
      'IDX_contact_import_job_applications_import_job_unique',
    );

    const table = await queryRunner.getTable('contacts');
    if (table?.columns.some((col) => col.name === 'custom_fields')) {
      await queryRunner.dropColumn('contacts', 'custom_fields');
    }
  }
}
