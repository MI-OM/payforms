import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform impersonation sessions (Part 3, Wave B item 9 — IN v1).
 *
 * `impersonation_sessions` is a control-plane table: it references an
 * organization and a tenant user but is intentionally NOT added to the tenant
 * RLS policy set (see `EnforceRLSPolicies1777300000000`) — only platform routes
 * read or write it, and the tenant auth hot path reads a single row by id.
 *
 * Purely additive and idempotent.
 */
export class AddImpersonationSessions1777900000000 implements MigrationInterface {
  name = 'AddImpersonationSessions1777900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "impersonation_sessions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "platform_user_id" uuid NOT NULL,
        "platform_user_email" character varying(320) NOT NULL,
        "organization_id" uuid NOT NULL,
        "target_user_id" uuid NOT NULL,
        "target_user_email" character varying(320) NOT NULL,
        "reason" character varying(500) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'active',
        "expires_at" TIMESTAMP NOT NULL,
        "ended_at" TIMESTAMP,
        "ended_by_platform_user_id" uuid,
        "ended_by_email" character varying(320),
        "metadata" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_impersonation_sessions_id" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_impersonation_sessions_org" ON "impersonation_sessions" ("organization_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_impersonation_sessions_platform_user" ON "impersonation_sessions" ("platform_user_id")',
    );
    await queryRunner.query(
      'CREATE INDEX IF NOT EXISTS "IDX_impersonation_sessions_status" ON "impersonation_sessions" ("status")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_impersonation_sessions_status"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_impersonation_sessions_platform_user"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_impersonation_sessions_org"');
    await queryRunner.query('DROP TABLE IF EXISTS "impersonation_sessions"');
  }
}
