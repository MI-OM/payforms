import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOrganizationTenantDomainFields1743654000000 implements MigrationInterface {
  name = 'AddOrganizationTenantDomainFields1743654000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.addColumnIfMissing(
      queryRunner,
      'organizations',
      new TableColumn({
        name: 'subdomain',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'organizations',
      new TableColumn({
        name: 'custom_domain',
        type: 'varchar',
        isNullable: true,
      }),
    );

    await queryRunner.query(`UPDATE "organizations" SET "subdomain" = LOWER("subdomain") WHERE "subdomain" IS NOT NULL`);
    await queryRunner.query(`UPDATE "organizations" SET "custom_domain" = LOWER("custom_domain") WHERE "custom_domain" IS NOT NULL`);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organizations_subdomain_unique" ON "organizations" ("subdomain") WHERE "subdomain" IS NOT NULL',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_organizations_custom_domain_unique" ON "organizations" ("custom_domain") WHERE "custom_domain" IS NOT NULL',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_organizations_custom_domain_unique"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_organizations_subdomain_unique"');

    await this.dropColumnIfExists(queryRunner, 'organizations', 'custom_domain');
    await this.dropColumnIfExists(queryRunner, 'organizations', 'subdomain');
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
