import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform admin notifications (Part 3, Wave A, Module 4).
 *
 * `platform_notifications` records what a platform operator broadcast (or sent
 * to one organization); `platform_notification_deliveries` records the
 * per-recipient send result so broadcasts are auditable and retryable.
 *
 * Both are control-plane tables with an optional `organization_id` and are
 * intentionally NOT added to the tenant RLS policy set (see
 * `EnforceRLSPolicies1777300000000`): only platform routes touch them.
 *
 * Purely additive and idempotent.
 */
export class AddPlatformNotifications1777700000000 implements MigrationInterface {
  name = 'AddPlatformNotifications1777700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_notifications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "subject" character varying NOT NULL,
        "body" text NOT NULL,
        "channel" character varying NOT NULL DEFAULT 'EMAIL',
        "audience_type" character varying NOT NULL,
        "segment" jsonb,
        "organization_id" uuid,
        "status" character varying NOT NULL DEFAULT 'queued',
        "total_recipients" integer NOT NULL DEFAULT 0,
        "sent_count" integer NOT NULL DEFAULT 0,
        "failed_count" integer NOT NULL DEFAULT 0,
        "skipped_count" integer NOT NULL DEFAULT 0,
        "created_by_platform_user_id" uuid,
        "created_by_email" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_notifications_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_created_at" ON "platform_notifications" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_status" ON "platform_notifications" ("status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notifications_audience" ON "platform_notifications" ("audience_type")',
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_notification_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "notification_id" uuid NOT NULL,
        "organization_id" uuid,
        "recipient_email" character varying NOT NULL,
        "recipient_user_id" uuid,
        "status" character varying NOT NULL,
        "error" text,
        "sent_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_notification_deliveries_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notification_deliveries_notification" ON "platform_notification_deliveries" ("notification_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notification_deliveries_notification_status" ON "platform_notification_deliveries" ("notification_id", "status")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_notification_deliveries_org" ON "platform_notification_deliveries" ("organization_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_notification_deliveries_org"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_platform_notification_deliveries_notification_status"',
    );
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_platform_notification_deliveries_notification"',
    );
    await queryRunner.query('DROP TABLE IF EXISTS "platform_notification_deliveries"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_notifications_audience"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_notifications_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_notifications_created_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "platform_notifications"');
  }
}
