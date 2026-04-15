import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddComplianceExportPackTables1777100000000 implements MigrationInterface {
  name = 'AddComplianceExportPackTables1777100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "compliance_export_jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "requested_by_user_id" uuid NOT NULL,
        "status" character varying NOT NULL DEFAULT 'QUEUED',
        "scope" jsonb,
        "request_reason" text,
        "completed_at" TIMESTAMP,
        "download_url" character varying,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compliance_export_jobs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compliance_export_jobs_org_created"
      ON "compliance_export_jobs" ("organization_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compliance_export_jobs_org_status"
      ON "compliance_export_jobs" ("organization_id", "status")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "compliance_export_artifacts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "job_id" uuid NOT NULL,
        "artifact_type" character varying NOT NULL,
        "file_path" character varying NOT NULL,
        "checksum" character varying,
        "size_bytes" bigint,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_compliance_export_artifacts_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compliance_export_artifacts_job_created"
      ON "compliance_export_artifacts" ("job_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_compliance_export_artifacts_org_type"
      ON "compliance_export_artifacts" ("organization_id", "artifact_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_compliance_export_artifacts_org_type"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_compliance_export_artifacts_job_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "compliance_export_artifacts"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_compliance_export_jobs_org_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_compliance_export_jobs_org_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "compliance_export_jobs"');
  }
}
