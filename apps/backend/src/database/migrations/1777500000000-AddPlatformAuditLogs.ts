import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform admin audit trail (Part 3, Wave A, Module 2).
 *
 * Records actions taken by platform admins. Needed because the tenant
 * `AuditInterceptor` only writes rows for requests carrying an
 * `organization_id`, and platform requests have none.
 *
 * `platform_audit_logs` intentionally has NO `organization_id` and is NOT part
 * of the tenant RLS policy set: platform operators exist above tenants. It is
 * append-only and never joined into tenant queries.
 */
export class AddPlatformAuditLogs1777500000000 implements MigrationInterface {
  name = 'AddPlatformAuditLogs1777500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "actor_id" uuid,
        "actor_email" character varying,
        "actor_role" character varying,
        "action" character varying NOT NULL,
        "resource_type" character varying,
        "resource_id" character varying,
        "method" character varying NOT NULL,
        "path" character varying NOT NULL,
        "status_code" integer,
        "ip_address" character varying,
        "user_agent" character varying,
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_audit_logs_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_created_at" ON "platform_audit_logs" ("created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_actor" ON "platform_audit_logs" ("actor_id", "created_at")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_action" ON "platform_audit_logs" ("action")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_platform_audit_logs_resource" ON "platform_audit_logs" ("resource_type", "resource_id")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_audit_logs_resource"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_audit_logs_action"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_audit_logs_actor"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_audit_logs_created_at"');
    await queryRunner.query('DROP TABLE IF EXISTS "platform_audit_logs"');
  }
}
