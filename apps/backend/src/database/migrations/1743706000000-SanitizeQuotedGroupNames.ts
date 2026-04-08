import { MigrationInterface, QueryRunner } from 'typeorm';

type GroupRow = {
  id: string;
  organization_id: string;
  name: string;
  parent_group_id: string | null;
};

export class SanitizeQuotedGroupNames1743706000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const groups = await queryRunner.query(
      `SELECT id, organization_id, name, parent_group_id FROM groups ORDER BY organization_id ASC, created_at ASC, id ASC`,
    ) as GroupRow[];

    const survivors = new Map<string, string>();

    for (const group of groups) {
      const sanitizedName = this.sanitizeName(group.name);
      const normalizedKey = `${group.organization_id}:${sanitizedName.toLowerCase()}`;
      const existingId = survivors.get(normalizedKey);

      if (!existingId) {
        if (sanitizedName !== group.name) {
          await queryRunner.query('UPDATE groups SET name = $1 WHERE id = $2', [sanitizedName, group.id]);
        }
        survivors.set(normalizedKey, group.id);
        continue;
      }

      if (existingId === group.id) {
        continue;
      }

      await queryRunner.query('UPDATE groups SET parent_group_id = $1 WHERE parent_group_id = $2 AND id <> $1', [existingId, group.id]);
      await queryRunner.query('UPDATE contact_groups SET group_id = $1 WHERE group_id = $2', [existingId, group.id]);
      await queryRunner.query('UPDATE form_groups SET group_id = $1 WHERE group_id = $2', [existingId, group.id]);
      await queryRunner.query(
        `DELETE FROM contact_groups a
         USING contact_groups b
         WHERE a.ctid < b.ctid
           AND a.contact_id = b.contact_id
           AND a.group_id = b.group_id`,
      );
      await queryRunner.query(
        `DELETE FROM form_groups a
         USING form_groups b
         WHERE a.ctid < b.ctid
           AND a.form_id = b.form_id
           AND a.group_id = b.group_id`,
      );
      await queryRunner.query('DELETE FROM groups WHERE id = $1', [group.id]);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('SELECT 1');
  }

  private sanitizeName(value: string) {
    const normalized = String(value || '')
      .trim()
      .replace(/\\"/g, '"')
      .replace(/^\"+|\"+$/g, '')
      .trim();

    return normalized || value;
  }
}