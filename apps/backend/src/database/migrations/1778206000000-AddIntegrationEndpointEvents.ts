import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Gives integration endpoints a name and an event subscription list.
 *
 * Without an event list, every active endpoint received every event, so an
 * endpoint that only cared about payments was also woken up for every
 * submission. An empty list means "all events", which keeps the simplest
 * configuration working.
 */
export class AddIntegrationEndpointEvents1778206000000 implements MigrationInterface {
  name = 'AddIntegrationEndpointEvents1778206000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('integration_endpoints');
    if (!table) {
      return;
    }

    const columns: TableColumn[] = [
      new TableColumn({
        name: 'name',
        type: 'varchar',
        isNullable: true,
        comment: 'Human-readable label for the endpoint',
      }),
      new TableColumn({
        name: 'events',
        type: 'jsonb',
        isNullable: false,
        default: "'[]'::jsonb",
        comment: 'Event types this endpoint subscribes to. Empty means all events.',
      }),
    ];

    for (const column of columns) {
      const exists = table.columns.some((col) => col.name === column.name);
      if (!exists) {
        await queryRunner.addColumn('integration_endpoints', column);
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('integration_endpoints');
    if (!table) {
      return;
    }

    for (const columnName of ['name', 'events']) {
      if (table.columns.some((col) => col.name === columnName)) {
        await queryRunner.dropColumn('integration_endpoints', columnName);
      }
    }
  }
}
