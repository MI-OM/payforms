import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMarketReadinessOperationalTables1776500000000 implements MigrationInterface {
  name = 'AddMarketReadinessOperationalTables1776500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "checkout_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "form_id" uuid,
        "contact_id" uuid,
        "reference" character varying,
        "status" character varying NOT NULL DEFAULT 'STARTED',
        "completed_at" TIMESTAMP,
        "metadata" jsonb,
        "started_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_checkout_sessions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_checkout_sessions_org_started"
      ON "checkout_sessions" ("organization_id", "started_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_checkout_sessions_org_status"
      ON "checkout_sessions" ("organization_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_recovery_candidates" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "payment_id" uuid NOT NULL,
        "reference" character varying NOT NULL,
        "status" character varying NOT NULL DEFAULT 'OPEN',
        "last_notified_at" TIMESTAMP,
        "attempt_count" integer NOT NULL DEFAULT 0,
        "metadata" jsonb,
        "detected_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_recovery_candidates_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_payment_recovery_candidates_payment" UNIQUE ("payment_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_recovery_candidates_org_detected"
      ON "payment_recovery_candidates" ("organization_id", "detected_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_recovery_candidates_org_status"
      ON "payment_recovery_candidates" ("organization_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payment_recovery_events" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "candidate_id" uuid,
        "event_type" character varying NOT NULL,
        "payload" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_payment_recovery_events_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_payment_recovery_events_candidate_created"
      ON "payment_recovery_events" ("candidate_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payment_recovery_events_candidate_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "payment_recovery_events"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payment_recovery_candidates_org_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payment_recovery_candidates_org_detected"');
    await queryRunner.query('DROP TABLE IF EXISTS "payment_recovery_candidates"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_checkout_sessions_org_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_checkout_sessions_org_started"');
    await queryRunner.query('DROP TABLE IF EXISTS "checkout_sessions"');
  }
}
