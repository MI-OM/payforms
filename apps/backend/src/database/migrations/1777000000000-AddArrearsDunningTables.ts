import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class AddArrearsDunningTables1777000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create dunning_campaigns table
    await queryRunner.createTable(
      new Table({
        name: 'dunning_campaigns',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'DRAFT'",
            isNullable: false,
          },
          {
            name: 'min_days_overdue',
            type: 'int',
            default: '7',
            isNullable: false,
          },
          {
            name: 'max_days_overdue',
            type: 'int',
            default: '365',
            isNullable: false,
          },
          {
            name: 'min_outstanding_amount',
            type: 'numeric',
            precision: 19,
            scale: 4,
            default: '0',
            isNullable: false,
          },
          {
            name: 'escalation_rules',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
          },
          {
            name: 'filter_criteria',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
          },
          {
            name: 'execution_frequency',
            type: 'varchar',
            length: '50',
            default: "'MANUAL'",
            isNullable: false,
          },
          {
            name: 'total_runs',
            type: 'int',
            default: '0',
            isNullable: false,
          },
          {
            name: 'total_outstanding_snapshot',
            type: 'numeric',
            precision: 19,
            scale: 4,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'last_executed_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['organization_id'],
            name: 'IDX_dunning_campaigns_org_id',
          }),
          new TableIndex({
            columnNames: ['status'],
            name: 'IDX_dunning_campaigns_status',
          }),
          new TableIndex({
            columnNames: ['organization_id', 'status'],
            name: 'IDX_dunning_campaigns_org_status',
          }),
        ],
      }),
    );

    // Create dunning_runs table
    await queryRunner.createTable(
      new Table({
        name: 'dunning_runs',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'campaign_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'SCHEDULED'",
            isNullable: false,
          },
          {
            name: 'scheduled_for',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'started_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'completed_at',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'contacts_evaluated',
            type: 'int',
            default: '0',
            isNullable: false,
          },
          {
            name: 'contacts_escalated',
            type: 'int',
            default: '0',
            isNullable: false,
          },
          {
            name: 'notifications_sent',
            type: 'int',
            default: '0',
            isNullable: false,
          },
          {
            name: 'total_outstanding',
            type: 'numeric',
            precision: 19,
            scale: 4,
            default: '0',
            isNullable: false,
          },
          {
            name: 'summary',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
          },
          {
            name: 'error_message',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['campaign_id'],
            referencedTableName: 'dunning_campaigns',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['campaign_id'],
            name: 'IDX_dunning_runs_campaign_id',
          }),
          new TableIndex({
            columnNames: ['status'],
            name: 'IDX_dunning_runs_status',
          }),
          new TableIndex({
            columnNames: ['campaign_id', 'status'],
            name: 'IDX_dunning_runs_campaign_status',
          }),
        ],
      }),
    );

    // Create arrears_snapshots table
    await queryRunner.createTable(
      new Table({
        name: 'arrears_snapshots',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'uuid_generate_v4()',
          },
          {
            name: 'run_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'contact_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'outstanding_amount',
            type: 'numeric',
            precision: 19,
            scale: 4,
            isNullable: false,
          },
          {
            name: 'days_overdue',
            type: 'int',
            isNullable: false,
          },
          {
            name: 'current_stage',
            type: 'int',
            default: '0',
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'NOT_STARTED'",
            isNullable: false,
          },
          {
            name: 'delinquency_start_date',
            type: 'timestamp',
            isNullable: true,
          },
          {
            name: 'metadata',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
          },
          {
            name: 'captured_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
        ],
        foreignKeys: [
          new TableForeignKey({
            columnNames: ['run_id'],
            referencedTableName: 'dunning_runs',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
          new TableForeignKey({
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          }),
        ],
        indices: [
          new TableIndex({
            columnNames: ['run_id'],
            name: 'IDX_arrears_snapshots_run_id',
          }),
          new TableIndex({
            columnNames: ['contact_id'],
            name: 'IDX_arrears_snapshots_contact_id',
          }),
          new TableIndex({
            columnNames: ['run_id', 'contact_id'],
            name: 'IDX_arrears_snapshots_run_contact',
          }),
          new TableIndex({
            columnNames: ['status'],
            name: 'IDX_arrears_snapshots_status',
          }),
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop in reverse order (respecting foreign key constraints)
    await queryRunner.dropTable('arrears_snapshots');
    await queryRunner.dropTable('dunning_runs');
    await queryRunner.dropTable('dunning_campaigns');
  }
}
