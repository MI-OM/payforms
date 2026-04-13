import { MigrationInterface, QueryRunner } from 'typeorm';

export class FixContactNotificationsPkDefault1776300000000 implements MigrationInterface {
  name = 'FixContactNotificationsPkDefault1776300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Ensure the uuid-ossp extension is installed
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Backfill any existing rows that somehow have a null id (should not exist, but safe to run)
    await queryRunner.query(`
      UPDATE "contact_notifications"
      SET "id" = uuid_generate_v4()
      WHERE "id" IS NULL
    `);

    // Set the column default so TypeORM .create() + .save() works without explicitly supplying an id
    await queryRunner.query(`
      ALTER TABLE "contact_notifications"
      ALTER COLUMN "id" SET DEFAULT uuid_generate_v4()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "contact_notifications"
      ALTER COLUMN "id" DROP DEFAULT
    `);
  }
}
