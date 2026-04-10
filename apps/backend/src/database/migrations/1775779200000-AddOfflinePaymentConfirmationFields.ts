import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddOfflinePaymentConfirmationFields1775779200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const confirmedAtExists = await queryRunner.hasColumn('payments', 'confirmed_at');
    if (!confirmedAtExists) {
      await queryRunner.addColumn('payments', new TableColumn({
        name: 'confirmed_at',
        type: 'timestamp',
        isNullable: true,
      }));
    }

    const confirmedByExists = await queryRunner.hasColumn('payments', 'confirmed_by_user_id');
    if (!confirmedByExists) {
      await queryRunner.addColumn('payments', new TableColumn({
        name: 'confirmed_by_user_id',
        type: 'uuid',
        isNullable: true,
      }));
    }

    const confirmationNoteExists = await queryRunner.hasColumn('payments', 'confirmation_note');
    if (!confirmationNoteExists) {
      await queryRunner.addColumn('payments', new TableColumn({
        name: 'confirmation_note',
        type: 'text',
        isNullable: true,
      }));
    }

    const externalReferenceExists = await queryRunner.hasColumn('payments', 'external_reference');
    if (!externalReferenceExists) {
      await queryRunner.addColumn('payments', new TableColumn({
        name: 'external_reference',
        type: 'varchar',
        isNullable: true,
      }));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const externalReferenceExists = await queryRunner.hasColumn('payments', 'external_reference');
    if (externalReferenceExists) {
      await queryRunner.dropColumn('payments', 'external_reference');
    }

    const confirmationNoteExists = await queryRunner.hasColumn('payments', 'confirmation_note');
    if (confirmationNoteExists) {
      await queryRunner.dropColumn('payments', 'confirmation_note');
    }

    const confirmedByExists = await queryRunner.hasColumn('payments', 'confirmed_by_user_id');
    if (confirmedByExists) {
      await queryRunner.dropColumn('payments', 'confirmed_by_user_id');
    }

    const confirmedAtExists = await queryRunner.hasColumn('payments', 'confirmed_at');
    if (confirmedAtExists) {
      await queryRunner.dropColumn('payments', 'confirmed_at');
    }
  }
}