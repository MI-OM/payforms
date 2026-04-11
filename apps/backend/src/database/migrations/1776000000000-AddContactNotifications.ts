import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddContactNotifications1776000000000 implements MigrationInterface {
  name = 'AddContactNotifications1776000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_notifications" (
        "id" uuid NOT NULL,
        "organization_id" uuid NOT NULL,
        "created_by_user_id" uuid,
        "title" character varying NOT NULL,
        "body" text NOT NULL,
        "type" character varying NOT NULL DEFAULT 'GENERAL',
        "audience_type" character varying NOT NULL DEFAULT 'ALL_CONTACTS',
        "target_contact_ids" uuid array,
        "read_by_contact_ids" uuid array NOT NULL DEFAULT ARRAY[]::uuid[],
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_notifications_org_created_at"
      ON "contact_notifications" ("organization_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_contact_notifications_org_created_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "contact_notifications"');
  }
}
