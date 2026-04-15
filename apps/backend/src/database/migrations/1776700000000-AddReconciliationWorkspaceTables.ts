import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddReconciliationWorkspaceTables1776700000000 implements MigrationInterface {
  name = 'AddReconciliationWorkspaceTables1776700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliation_runs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "period_start" date NOT NULL,
        "period_end" date NOT NULL,
        "status" character varying NOT NULL DEFAULT 'PENDING',
        "summary" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_runs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliation_runs_org_created"
      ON "reconciliation_runs" ("organization_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "reconciliation_exceptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "run_id" uuid NOT NULL,
        "payment_id" uuid,
        "reference" character varying,
        "type" character varying NOT NULL,
        "severity" character varying NOT NULL DEFAULT 'MEDIUM',
        "status" character varying NOT NULL DEFAULT 'OPEN',
        "details" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_reconciliation_exceptions_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliation_exceptions_run_status"
      ON "reconciliation_exceptions" ("run_id", "status")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_reconciliation_exceptions_org_created"
      ON "reconciliation_exceptions" ("organization_id", "created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_reconciliation_exceptions_org_created"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_reconciliation_exceptions_run_status"');
    await queryRunner.query('DROP TABLE IF EXISTS "reconciliation_exceptions"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_reconciliation_runs_org_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "reconciliation_runs"');
  }
}
