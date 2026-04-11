import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInternalNotifications1743708000000 implements MigrationInterface {
  name = 'AddInternalNotifications1743708000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "internal_notifications" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "audience_type" character varying NOT NULL DEFAULT 'ALL_USERS',
        "target_user_ids" uuid array,
        "read_by_user_ids" uuid array NOT NULL DEFAULT ARRAY[]::uuid[],
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_internal_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_internal_notifications_org_created_at"
      ON "internal_notifications" ("organization_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_internal_notifications_org_created_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "internal_notifications"');
  }
}