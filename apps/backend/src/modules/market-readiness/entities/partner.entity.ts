import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PartnerStatus = 'ACTIVE' | 'INACTIVE';

@Entity('partners')
@Index('IDX_partners_org_created', ['organization_id', 'created_at'])
export class Partner {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'varchar', enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' })
  status: PartnerStatus;

  @Column({ type: 'jsonb', nullable: true })
  config: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}