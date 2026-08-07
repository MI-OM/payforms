import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserSoftDeleteFields1777200000001 implements MigrationInterface {
  name = 'AddUserSoftDeleteFields1777200000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "is_active" boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE "users"
      ADD COLUMN "deactivated_at" TIMESTAMP NULL
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_users_org_active" ON "users" ("organization_id", "is_active")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_users_org_active"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "deactivated_at"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_active"`);
  }
}