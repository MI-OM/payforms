import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddTwoFactorAuthenticationSupport1778203000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Add 2FA columns to contacts table (if not already present)
    // =========================================================================
    // Extends contact entity with TOTP (Google Authenticator) support.
    // Allows contacts to optionally enable 2FA on their account.
    //
    // Fields:
    // - two_factor_enabled: Master flag (true = 2FA is active and enforced)
    // - two_factor_secret: Encrypted TOTP secret (base32 encoded)
    // - two_factor_temp_secret: Temporary secret during setup (before confirmation)
    // - two_factor_temp_expires_at: Expiry of temp secret (15 min window)
    // - two_factor_recovery_codes: JSON array of recovery codes (for account recovery)
    // - two_factor_backup_email: Optional backup email for recovery codes
    // =========================================================================
    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_enabled',
        type: 'boolean',
        default: false,
        isNullable: false,
        comment: 'Whether 2FA is enabled and enforced for this contact',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_secret',
        type: 'text',
        isNullable: true,
        comment: 'Encrypted TOTP secret (base32, AES-256-GCM encrypted)',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_temp_secret',
        type: 'text',
        isNullable: true,
        comment: 'Temporary secret during setup (before user confirms)',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_temp_expires_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Expiry of temp secret (15 min window)',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_recovery_codes',
        type: 'text',
        isNullable: true,
        comment: 'JSON array of encrypted recovery codes (for account recovery)',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'contacts',
      new TableColumn({
        name: 'two_factor_backup_email',
        type: 'varchar',
        isNullable: true,
        comment: 'Optional backup email for recovery codes delivery',
      }),
    );

    // =========================================================================
    // User (staff) 2FA columns already exist (from earlier schema)
    // Just ensure they're present and correct
    // =========================================================================
    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'two_factor_enabled',
        type: 'boolean',
        default: false,
        isNullable: false,
        comment: 'Whether 2FA is enabled for this staff user (OPTIONAL)',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'two_factor_secret',
        type: 'text',
        isNullable: true,
        comment: 'Encrypted TOTP secret',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'two_factor_temp_secret',
        type: 'text',
        isNullable: true,
        comment: 'Temporary secret during 2FA setup',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'two_factor_temp_expires_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Expiry of temp secret',
      }),
    );

    await this.addColumnIfMissing(
      queryRunner,
      'users',
      new TableColumn({
        name: 'two_factor_recovery_codes',
        type: 'text',
        isNullable: true,
        comment: 'JSON array of encrypted recovery codes',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop contact 2FA columns
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_enabled');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_secret');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_temp_secret');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_temp_expires_at');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_recovery_codes');
    await this.dropColumnIfExists(queryRunner, 'contacts', 'two_factor_backup_email');

    // Do NOT drop user 2FA columns (they may already exist and be in use)
    // This migration is additive only for contacts
  }

  private async addColumnIfMissing(
    queryRunner: QueryRunner,
    tableName: string,
    column: TableColumn,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const columnExists = table?.columns.some(col => col.name === column.name);
    if (!columnExists) {
      await queryRunner.addColumn(tableName, column);
    }
  }

  private async dropColumnIfExists(
    queryRunner: QueryRunner,
    tableName: string,
    columnName: string,
  ): Promise<void> {
    const table = await queryRunner.getTable(tableName);
    const columnExists = table?.columns.some(col => col.name === columnName);
    if (columnExists) {
      await queryRunner.dropColumn(tableName, columnName);
    }
  }
}
