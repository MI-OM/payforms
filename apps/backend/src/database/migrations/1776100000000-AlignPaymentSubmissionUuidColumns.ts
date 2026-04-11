import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignPaymentSubmissionUuidColumns1776100000000 implements MigrationInterface {
  name = 'AlignPaymentSubmissionUuidColumns1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "organization_id" TYPE uuid USING NULLIF("organization_id", '')::uuid,
        ALTER COLUMN "submission_id" TYPE uuid USING NULLIF("submission_id", '')::uuid
    `);

    await queryRunner.query(`
      ALTER TABLE "submissions"
        ALTER COLUMN "organization_id" TYPE uuid USING NULLIF("organization_id", '')::uuid,
        ALTER COLUMN "form_id" TYPE uuid USING NULLIF("form_id", '')::uuid,
        ALTER COLUMN "contact_id" TYPE uuid USING NULLIF("contact_id", '')::uuid
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "submissions"
        ALTER COLUMN "contact_id" TYPE character varying,
        ALTER COLUMN "form_id" TYPE character varying,
        ALTER COLUMN "organization_id" TYPE character varying
    `);

    await queryRunner.query(`
      ALTER TABLE "payments"
        ALTER COLUMN "submission_id" TYPE character varying,
        ALTER COLUMN "organization_id" TYPE character varying
    `);
  }
}
