import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Converts organizations.status from varchar to enum type.
 * 
 * This migration enforces lowercase status values ('active', 'suspended', 'disabled')
 * at the database level, preventing the security risk of mixed-case values bypassing
 * hard stop logic.
 * 
 * Critical: This fixes Bug #1 in the Platform Admin Console security audit.
 * Safe to run: All existing status values are already lowercase per application logic.
 */
export class AlterOrganizationStatusToEnum1778000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create the enum type
    await queryRunner.query(`
      CREATE TYPE organization_status_enum AS ENUM ('active', 'suspended', 'disabled');
    `);

    // 2. Convert any potential uppercase values to lowercase (defensive)
    await queryRunner.query(`
      UPDATE organizations
      SET status = LOWER(status)
      WHERE status IN ('ACTIVE', 'SUSPENDED', 'DISABLED', 'Active', 'Suspended', 'Disabled');
    `);

    // 3. Alter the column to use the enum type
    await queryRunner.query(`
      ALTER TABLE organizations
      ALTER COLUMN status TYPE organization_status_enum
      USING status::organization_status_enum;
    `);

    // 4. Set default value
    await queryRunner.query(`
      ALTER TABLE organizations
      ALTER COLUMN status SET DEFAULT 'active'::organization_status_enum;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revert to varchar
    await queryRunner.query(`
      ALTER TABLE organizations
      ALTER COLUMN status TYPE varchar
      USING status::varchar;
    `);

    await queryRunner.query(`
      ALTER TABLE organizations
      ALTER COLUMN status SET DEFAULT 'active';
    `);

    // Drop the enum type
    await queryRunner.query(`
      DROP TYPE IF EXISTS organization_status_enum;
    `);
  }
}
