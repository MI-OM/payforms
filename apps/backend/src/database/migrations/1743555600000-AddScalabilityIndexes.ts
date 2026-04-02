import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddScalabilityIndexes1743555600000 implements MigrationInterface {
  name = 'AddScalabilityIndexes1743555600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_contacts_org_created_at" ON "contacts" ("organization_id", "created_at")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_contacts_password_reset_token" ON "contacts" ("password_reset_token")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_groups_org_parent" ON "groups" ("organization_id", "parent_group_id")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_forms_org_created_at" ON "forms" ("organization_id", "created_at")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_forms_org_is_active" ON "forms" ("organization_id", "is_active")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_submissions_org_contact" ON "submissions" ("organization_id", "contact_id")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_submissions_org_created_at" ON "submissions" ("organization_id", "created_at")');
    await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_payments_org_created_at" ON "payments" ("organization_id", "created_at")');
    const hasUsersPasswordResetToken = await queryRunner.hasColumn('users', 'password_reset_token');
    if (hasUsersPasswordResetToken) {
      await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_users_password_reset_token" ON "users" ("password_reset_token")');
    }
    const hasOrgEmailVerificationToken = await queryRunner.hasColumn('organizations', 'email_verification_token');
    if (hasOrgEmailVerificationToken) {
      await queryRunner.query('CREATE INDEX IF NOT EXISTS "IDX_org_email_verification_token" ON "organizations" ("email_verification_token")');
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_org_email_verification_token"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_users_password_reset_token"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_payments_org_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_submissions_org_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_submissions_org_contact"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_forms_org_is_active"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_forms_org_created_at"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_groups_org_parent"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_contacts_password_reset_token"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_contacts_org_created_at"');
  }
}

