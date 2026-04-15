import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddIntegrationsTables1776800000000 implements MigrationInterface {
  name = 'AddIntegrationsTables1776800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_endpoints" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "type" character varying NOT NULL,
        "target" character varying NOT NULL,
        "secret" character varying NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "config" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integration_endpoints_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_endpoints_org_active"
      ON "integration_endpoints" ("organization_id", "active")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integration_deliveries" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "endpoint_id" uuid NOT NULL,
        "event_type" character varying NOT NULL,
        "payload_hash" character varying(128) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'QUEUED',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_error" text,
        "delivered_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_integration_deliveries_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_deliveries_endpoint_created"
      ON "integration_deliveries" ("endpoint_id", "created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_integration_deliveries_org_status"
      ON "integration_deliveries" ("organization_id", "status")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_integration_deliveries_org_status"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_integration_deliveries_endpoint_created"');
    await queryRunner.query('DROP TABLE IF EXISTS "integration_deliveries"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_integration_endpoints_org_active"');
    await queryRunner.query('DROP TABLE IF EXISTS "integration_endpoints"');
  }
}