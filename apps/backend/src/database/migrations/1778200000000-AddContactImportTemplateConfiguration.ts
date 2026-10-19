import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddContactImportTemplateConfiguration1778200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Create contact_import_templates table
    // =========================================================================
    // Stores custom import templates per organization.
    // Each template defines which fields are required, optional, or hidden during
    // contact imports. Orgs can create multiple templates and switch between them.
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'contact_import_templates',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          }),
          new TableColumn({
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'name',
            type: 'varchar',
            isNullable: false,
          }),
          new TableColumn({
            name: 'description',
            type: 'text',
            isNullable: true,
          }),
          new TableColumn({
            name: 'is_default',
            type: 'boolean',
            default: false,
            isNullable: false,
          }),
          new TableColumn({
            name: 'fields_config',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
            comment: 'Field visibility and requirement config: {field_name: {visible: bool, required: bool, label: string}}',
          }),
          new TableColumn({
            name: 'custom_fields',
            type: 'jsonb',
            default: '[]::jsonb',
            isNullable: false,
            comment: 'Array of custom fields: [{id, name, type (text/email/phone/number/select), required, options}]',
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
          new TableColumn({
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_contact_import_templates_org_default',
            columnNames: ['organization_id', 'is_default'],
          }),
          new TableIndex({
            name: 'IDX_contact_import_templates_org_name',
            columnNames: ['organization_id', 'name'],
            isUnique: true,
          }),
        ],
        foreignKeys: [
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // =========================================================================
    // Create contact_import_job_applications table
    // =========================================================================
    // Tracks which template was used for each import job.
    // This allows org admins to audit which template definition was active
    // when contacts were imported.
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'contact_import_job_applications',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          }),
          new TableColumn({
            name: 'import_job_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'template_id',
            type: 'uuid',
            isNullable: true,
            comment: 'NULL = used default system template (backward compatibility)',
          }),
          new TableColumn({
            name: 'template_snapshot',
            type: 'jsonb',
            default: '{}',
            isNullable: false,
            comment: 'Snapshot of template config at time of import (for audit trail)',
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_contact_import_job_applications_import_job_id',
            columnNames: ['import_job_id'],
          }),
          new TableIndex({
            name: 'IDX_contact_import_job_applications_template_id',
            columnNames: ['template_id'],
          }),
        ],
        foreignKeys: [
          {
            columnNames: ['import_job_id'],
            referencedTableName: 'contact_imports',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['template_id'],
            referencedTableName: 'contact_import_templates',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );

    // =========================================================================
    // Add default template config to organizations table
    // =========================================================================
    // Stores which template is currently selected for imports.
    // =========================================================================
    await this.addColumnIfMissing(
      queryRunner,
      'organizations',
      new TableColumn({
        name: 'default_import_template_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // Add index for fast lookup
    await queryRunner.createIndex(
      'organizations',
      new TableIndex({
        name: 'IDX_organizations_default_import_template',
        columnNames: ['default_import_template_id'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraint if it exists
    const table = await queryRunner.getTable('organizations');
    const foreignKey = table?.foreignKeys.find(fk => fk.columnNames.includes('default_import_template_id'));
    if (foreignKey) {
      await queryRunner.dropForeignKey('organizations', foreignKey);
    }

    // Drop index and column
    await queryRunner.dropIndex('organizations', 'IDX_organizations_default_import_template');
    await this.dropColumnIfExists(queryRunner, 'organizations', 'default_import_template_id');

    // Drop application table
    await queryRunner.dropTable('contact_import_job_applications', true);

    // Drop template table
    await queryRunner.dropTable('contact_import_templates', true);
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const columnExists = table?.columns.some(col => col.name === column.name);
    if (!columnExists) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const columnExists = table?.columns.some(col => col.name === columnName);
    if (columnExists) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }
}
