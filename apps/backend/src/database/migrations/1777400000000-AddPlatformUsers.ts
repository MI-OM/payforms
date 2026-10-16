import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Platform admin identity table (Part 3, Wave A, Module 1).
 *
 * `platform_users` intentionally has NO `organization_id` and is NOT added to
 * the tenant RLS policy set: platform operators exist above tenants. Access is
 * enforced at the application layer by the dedicated `platform-jwt` strategy
 * and `PlatformJwtAuthGuard`, which use a secret distinct from the tenant JWT
 * secret so the two token families cannot be interchanged.
 */
export class AddPlatformUsers1777400000000 implements MigrationInterface {
  name = 'AddPlatformUsers1777400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "platform_users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying NOT NULL,
        "password_hash" character varying NOT NULL,
        "role" character varying NOT NULL DEFAULT 'SUPER',
        "first_name" character varying,
        "last_name" character varying,
        "is_active" boolean NOT NULL DEFAULT true,
        "last_login_at" TIMESTAMP,
        "refresh_token_hash" character varying,
        "two_factor_enabled" boolean NOT NULL DEFAULT false,
        "two_factor_secret" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_platform_users_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(
      'CREATE UNIQUE INDEX IF NOT EXISTS "IDX_platform_users_email_unique" ON "platform_users" ("email")',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_platform_users_email_unique"');
    await queryRunner.query('DROP TABLE IF EXISTS "platform_users"');
  }
}
