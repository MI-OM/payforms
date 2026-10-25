import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

/**
 * Makes integration deliveries actually deliverable.
 *
 * The original `integration_deliveries` table stored a SHA-256 hash of the
 * event payload but not the payload itself. That made the table an audit log,
 * not a queue — a worker could see that an event had been queued but had no
 * way to reconstruct what to POST, so deliveries could never be sent.
 *
 * This migration adds the pieces a delivery worker needs:
 *   - `payload`          the event body to POST
 *   - `next_attempt_at`  when the next retry is due (backoff scheduling)
 *   - `last_attempt_at`  when the last attempt happened
 *   - `response_status`  HTTP status returned by the endpoint
 *   - `response_body`    a truncated copy of the response, for debugging
 *
 * `next_attempt_at` is also what makes the queue indexable: the worker only
 * needs to look at rows that are due.
 */
export class AddIntegrationDeliveryPayload1778205000000 implements MigrationInterface {
  name = 'AddIntegrationDeliveryPayload1778205000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('integration_deliveries');
    if (!table) {
      return;
    }

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'payload',
        type: 'jsonb',
        isNullable: true,
        comment: 'Event body delivered to the endpoint. NULL for rows queued before this migration.',
      }),
      new TableColumn({
        name: 'next_attempt_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'When the next delivery attempt is due. NULL means "due now".',
      }),
      new TableColumn({
        name: 'last_attempt_at',
        type: 'timestamp',
        isNullable: true,
      }),
      new TableColumn({
        name: 'response_status',
        type: 'int',
        isNullable: true,
        comment: 'HTTP status returned by the endpoint on the last attempt',
      }),
      new TableColumn({
        name: 'response_body',
        type: 'text',
        isNullable: true,
        comment: 'Truncated response body from the endpoint, for debugging',
      }),
    ];

    for (const column of columns) {
      const exists = table.columns.some((col) => col.name === column.name);
      if (!exists) {
        await queryRunner.addColumn('integration_deliveries', column);
      }
    }

    const refreshed = await queryRunner.getTable('integration_deliveries');
    const indexExists = refreshed?.indices.some(
      (index) => index.name === 'IDX_integration_deliveries_due',
    );
    if (!indexExists) {
      await queryRunner.createIndex(
        'integration_deliveries',
        new TableIndex({
          name: 'IDX_integration_deliveries_due',
          columnNames: ['status', 'next_attempt_at'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('integration_deliveries', 'IDX_integration_deliveries_due');

    const table = await queryRunner.getTable('integration_deliveries');
    if (!table) {
      return;
    }

    for (const columnName of [
      'payload',
      'next_attempt_at',
      'last_attempt_at',
      'response_status',
      'response_body',
    ]) {
      if (table.columns.some((col) => col.name === columnName)) {
        await queryRunner.dropColumn('integration_deliveries', columnName);
      }
    }
  }
}
