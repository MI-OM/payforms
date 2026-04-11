import { MigrationInterface, QueryRunner } from 'typeorm';

type ColumnType = {
  data_type: string;
  udt_name: string;
};

async function getColumnType(
  queryRunner: QueryRunner,
  tableName: string,
  columnName: string,
): Promise<ColumnType | null> {
  const rows = await queryRunner.query(
    `
      SELECT data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
        AND column_name = $2
      LIMIT 1
    `,
    [tableName, columnName],
  );

  return rows[0] ?? null;
}

function isUuidColumn(columnType: ColumnType | null): boolean {
  return columnType?.data_type === 'uuid' || columnType?.udt_name === 'uuid';
}

function isStringCompatibleColumn(columnType: ColumnType | null): boolean {
  return columnType?.data_type === 'character varying' || columnType?.data_type === 'text';
}

function buildMissingValuePredicate(columnName: string, columnType: ColumnType | null): string {
  if (isStringCompatibleColumn(columnType)) {
    return `COALESCE(NULLIF(BTRIM("${columnName}"), ''), NULL) IS NULL`;
  }

  return `"${columnName}" IS NULL`;
}

export class AlignPaymentSubmissionUuidColumns1776100000000 implements MigrationInterface {
  name = 'AlignPaymentSubmissionUuidColumns1776100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const paymentsOrganizationIdType = await getColumnType(queryRunner, 'payments', 'organization_id');
    const paymentsSubmissionIdType = await getColumnType(queryRunner, 'payments', 'submission_id');
    const submissionsOrganizationIdType = await getColumnType(queryRunner, 'submissions', 'organization_id');
    const submissionsFormIdType = await getColumnType(queryRunner, 'submissions', 'form_id');
    const submissionsContactIdType = await getColumnType(queryRunner, 'submissions', 'contact_id');

    if (
      isStringCompatibleColumn(paymentsOrganizationIdType)
      || isStringCompatibleColumn(paymentsSubmissionIdType)
    ) {
      const paymentCleanupPredicates = [
        buildMissingValuePredicate('organization_id', paymentsOrganizationIdType),
        buildMissingValuePredicate('submission_id', paymentsSubmissionIdType),
      ];

      await queryRunner.query(`
        DELETE FROM "payments"
        WHERE ${paymentCleanupPredicates.join('\n           OR ')}
      `);
    }

    if (isStringCompatibleColumn(submissionsContactIdType)) {
      await queryRunner.query(`
        UPDATE "submissions"
        SET "contact_id" = NULL
        WHERE ${buildMissingValuePredicate('contact_id', submissionsContactIdType)}
      `);
    }

    if (
      isStringCompatibleColumn(submissionsOrganizationIdType)
      || isStringCompatibleColumn(submissionsFormIdType)
    ) {
      const submissionCleanupPredicates = [
        buildMissingValuePredicate('organization_id', submissionsOrganizationIdType),
        buildMissingValuePredicate('form_id', submissionsFormIdType),
      ];

      await queryRunner.query(`
        DELETE FROM "submissions"
        WHERE ${submissionCleanupPredicates.join('\n           OR ')}
      `);
    }

    const paymentAlterClauses: string[] = [];
    if (!isUuidColumn(paymentsOrganizationIdType)) {
      paymentAlterClauses.push(
        'ALTER COLUMN "organization_id" TYPE uuid USING NULLIF(TRIM("organization_id"), \'\')::uuid',
      );
    }
    if (!isUuidColumn(paymentsSubmissionIdType)) {
      paymentAlterClauses.push(
        'ALTER COLUMN "submission_id" TYPE uuid USING NULLIF(TRIM("submission_id"), \'\')::uuid',
      );
    }
    if (paymentAlterClauses.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "payments"
        ${paymentAlterClauses.join(',\n        ')}
      `);
    }

    const submissionAlterClauses: string[] = [];
    if (!isUuidColumn(submissionsOrganizationIdType)) {
      submissionAlterClauses.push(
        'ALTER COLUMN "organization_id" TYPE uuid USING NULLIF(TRIM("organization_id"), \'\')::uuid',
      );
    }
    if (!isUuidColumn(submissionsFormIdType)) {
      submissionAlterClauses.push(
        'ALTER COLUMN "form_id" TYPE uuid USING NULLIF(TRIM("form_id"), \'\')::uuid',
      );
    }
    if (!isUuidColumn(submissionsContactIdType)) {
      submissionAlterClauses.push(
        'ALTER COLUMN "contact_id" TYPE uuid USING NULLIF(TRIM("contact_id"), \'\')::uuid',
      );
    }
    if (submissionAlterClauses.length > 0) {
      await queryRunner.query(`
        ALTER TABLE "submissions"
        ${submissionAlterClauses.join(',\n        ')}
      `);
    }
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
