import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddInstallmentPlanTables1776600000000 implements MigrationInterface {
  name = 'AddInstallmentPlanTables1776600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "installment_plans" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "form_id" uuid NOT NULL,
        "name" character varying NOT NULL,
        "currency" character varying NOT NULL DEFAULT 'NGN',
        "total_amount" numeric(10,2) NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_installment_plans_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_installment_plans_org_form"
      ON "installment_plans" ("organization_id", "form_id")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "installment_plan_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "plan_id" uuid NOT NULL,
        "label" character varying NOT NULL,
        "amount" numeric(10,2) NOT NULL,
        "due_date" date NOT NULL,
        "penalty_rule" jsonb,
        "order_index" integer NOT NULL DEFAULT 0,
        CONSTRAINT "PK_installment_plan_items_id" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_installment_plan_items_plan_order"
      ON "installment_plan_items" ("plan_id", "order_index")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contact_installment_accounts" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "contact_id" uuid NOT NULL,
        "plan_id" uuid NOT NULL,
        "outstanding_amount" numeric(10,2) NOT NULL,
        "status" character varying NOT NULL DEFAULT 'ACTIVE',
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_contact_installment_accounts_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_contact_installment_accounts_contact_plan" UNIQUE ("contact_id", "plan_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_contact_installment_accounts_org_contact"
      ON "contact_installment_accounts" ("organization_id", "contact_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_contact_installment_accounts_org_contact"');
    await queryRunner.query('DROP TABLE IF EXISTS "contact_installment_accounts"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_installment_plan_items_plan_order"');
    await queryRunner.query('DROP TABLE IF EXISTS "installment_plan_items"');

    await queryRunner.query('DROP INDEX IF EXISTS "IDX_installment_plans_org_form"');
    await queryRunner.query('DROP TABLE IF EXISTS "installment_plans"');
  }
}
