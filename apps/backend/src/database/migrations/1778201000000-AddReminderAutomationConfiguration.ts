import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddReminderAutomationConfiguration1778201000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Create organization_reminder_policies table
    // =========================================================================
    // Stores organizations' reminder automation rules.
    // Each policy defines:
    // - When to send reminders (e.g., when balance_due > 5000 for > 7 days)
    // - Who should receive them (all contacts, specific groups, or both)
    // - Reminder message template
    // - Cooldown period (don't send to same contact within N days)
    // - Whether reminders are enabled/active
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'organization_reminder_policies',
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
            name: 'is_enabled',
            type: 'boolean',
            default: true,
            isNullable: false,
          }),
          new TableColumn({
            name: 'trigger_config',
            type: 'jsonb',
            default: "'{}'::jsonb",
            isNullable: false,
            comment: 'Trigger configuration: {balance_due_threshold, days_overdue_threshold}',
          }),
          new TableColumn({
            name: 'recipient_config',
            type: 'jsonb',
            default: "'{\"type\": \"all_with_balance_due\"}'::jsonb",
            isNullable: false,
            comment: 'Recipient selection configuration for this policy',
          }),
          new TableColumn({
            name: 'message_template',
            type: 'text',
            isNullable: false,
            comment: 'Reminder message template with placeholder support',
          }),
          new TableColumn({
            name: 'cooldown_days',
            type: 'integer',
            default: 7,
            isNullable: false,
            comment: 'Minimum days between reminders to the same contact',
          }),
          new TableColumn({
            name: 'last_executed_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'When this policy was last evaluated/executed',
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
            name: 'IDX_organization_reminder_policies_org_enabled',
            columnNames: ['organization_id', 'is_enabled'],
          }),
          new TableIndex({
            name: 'IDX_organization_reminder_policies_org_created_at',
            columnNames: ['organization_id', 'created_at'],
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
    // Create reminder_send_history table
    // =========================================================================
    // Audit trail of reminder executions.
    // Tracks which reminders were sent to which contacts and when.
    // Used for:
    // - Cooldown enforcement (don't send same contact within N days)
    // - Audit compliance (who was reminded about what)
    // - Retry/troubleshooting (if a contact email fails, can see when it was attempted)
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'reminder_send_history',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          }),
          new TableColumn({
            name: 'policy_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'contact_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'recipient_email',
            type: 'varchar',
            isNullable: false,
            comment: 'Email address the reminder was sent to (denormalized for audit)',
          }),
          new TableColumn({
            name: 'message_sent',
            type: 'text',
            isNullable: false,
            comment: 'Actual message sent (with placeholders filled in)',
          }),
          new TableColumn({
            name: 'balance_due_at_send',
            type: 'decimal',
            precision: 12,
            scale: 2,
            isNullable: true,
            comment: 'Balance due amount at time of send (for historical context)',
          }),
          new TableColumn({
            name: 'days_overdue_at_send',
            type: 'integer',
            isNullable: true,
            comment: 'Days overdue at time of send',
          }),
          new TableColumn({
            name: 'send_status',
            type: 'varchar',
            enum: ['sent', 'failed', 'bounced'],
            default: `'sent'`,
            isNullable: false,
          }),
          new TableColumn({
            name: 'error_message',
            type: 'text',
            isNullable: true,
            comment: 'Error details if send_status is not "sent"',
          }),
          new TableColumn({
            name: 'sent_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_reminder_send_history_policy_id',
            columnNames: ['policy_id'],
          }),
          new TableIndex({
            name: 'IDX_reminder_send_history_contact_id',
            columnNames: ['contact_id'],
          }),
          new TableIndex({
            name: 'IDX_reminder_send_history_org_contact_sent_at',
            columnNames: ['organization_id', 'contact_id', 'sent_at'],
          }),
        ],
        foreignKeys: [
          {
            columnNames: ['policy_id'],
            referencedTableName: 'organization_reminder_policies',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('reminder_send_history', true);
    await queryRunner.dropTable('organization_reminder_policies', true);
  }
}
