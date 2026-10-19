import { MigrationInterface, QueryRunner, Table, TableColumn, TableIndex } from 'typeorm';

export class AddQrCodeConfiguration1778202000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // =========================================================================
    // Create contact_qr_codes table
    // =========================================================================
    // Stores QR code metadata for contacts.
    // Each contact gets a unique, persistent QR code that encodes a secure token.
    // The token is used to:
    // - Generate dynamic payment status pages
    // - Protect against QR code replay/hijacking
    // - Track QR code scans for analytics
    //
    // Design:
    // - QR code token is stable per contact (doesn't change unless regenerated)
    // - Token is cryptographically random and unique per contact/org
    // - Supports multiple access modes: public (no auth), authenticated (contact login), staff (school staff scan)
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'contact_qr_codes',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          }),
          new TableColumn({
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'contact_id',
            type: 'uuid',
            isNullable: false,
            isUnique: true,
          }),
          new TableColumn({
            name: 'qr_token',
            type: 'varchar',
            isNullable: false,
            comment: 'Cryptographically random token (URL-safe base64, min 32 bytes)',
          }),
          new TableColumn({
            name: 'is_active',
            type: 'boolean',
            default: true,
            isNullable: false,
            comment: 'Whether QR code should be accessible. Can be disabled without deleting.',
          }),
          new TableColumn({
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
          new TableColumn({
            name: 'regenerated_at',
            type: 'timestamp',
            isNullable: true,
            comment: 'Last time token was regenerated (security measure)',
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_contact_qr_codes_org_contact',
            columnNames: ['organization_id', 'contact_id'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_contact_qr_codes_token',
            columnNames: ['qr_token'],
            isUnique: true,
          }),
          new TableIndex({
            name: 'IDX_contact_qr_codes_is_active',
            columnNames: ['organization_id', 'is_active'],
          }),
        ],
        foreignKeys: [
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
        ],
      }),
    );

    // =========================================================================
    // Create qr_code_scans table
    // =========================================================================
    // Audit trail of QR code scans.
    // Tracks who scanned the QR code, when, and from where (IP).
    //
    // Used for:
    // - Analytics: how often do staff/contacts check payment status
    // - Security: detect suspicious patterns (same QR scanned from multiple IPs)
    // - Compliance: audit trail of who accessed payment information
    // =========================================================================
    await queryRunner.createTable(
      new Table({
        name: 'qr_code_scans',
        columns: [
          new TableColumn({
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            default: 'gen_random_uuid()',
          }),
          new TableColumn({
            name: 'qr_code_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'organization_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'contact_id',
            type: 'uuid',
            isNullable: false,
          }),
          new TableColumn({
            name: 'scanned_by_user_id',
            type: 'uuid',
            isNullable: true,
            comment: 'Staff/admin who scanned (null if scanned by contact themselves)',
          }),
          new TableColumn({
            name: 'access_mode',
            type: 'varchar',
            enum: ['public', 'authenticated', 'staff'],
            isNullable: false,
            comment: 'How the QR was accessed: public (no auth), authenticated (contact login), staff (staff scan)',
          }),
          new TableColumn({
            name: 'ip_address',
            type: 'varchar',
            isNullable: true,
            comment: 'IP address of the scanner (for security auditing)',
          }),
          new TableColumn({
            name: 'user_agent',
            type: 'text',
            isNullable: true,
            comment: 'Browser/device user agent string',
          }),
          new TableColumn({
            name: 'scanned_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          }),
        ],
        indices: [
          new TableIndex({
            name: 'IDX_qr_code_scans_qr_code_id',
            columnNames: ['qr_code_id'],
          }),
          new TableIndex({
            name: 'IDX_qr_code_scans_contact_id',
            columnNames: ['contact_id'],
          }),
          new TableIndex({
            name: 'IDX_qr_code_scans_scanned_by_user_id',
            columnNames: ['scanned_by_user_id'],
          }),
          new TableIndex({
            name: 'IDX_qr_code_scans_org_contact_scanned_at',
            columnNames: ['organization_id', 'contact_id', 'scanned_at'],
          }),
        ],
        foreignKeys: [
          {
            columnNames: ['qr_code_id'],
            referencedTableName: 'contact_qr_codes',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['organization_id'],
            referencedTableName: 'organizations',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['contact_id'],
            referencedTableName: 'contacts',
            referencedColumnNames: ['id'],
            onDelete: 'CASCADE',
          },
          {
            columnNames: ['scanned_by_user_id'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          },
        ],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('qr_code_scans', true);
    await queryRunner.dropTable('contact_qr_codes', true);
  }
}
