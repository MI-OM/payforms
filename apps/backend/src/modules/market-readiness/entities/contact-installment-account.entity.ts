import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('contact_installment_accounts')
@Index('IDX_contact_installment_accounts_org_contact', ['organization_id', 'contact_id'])
@Index('UQ_contact_installment_accounts_contact_plan', ['contact_id', 'plan_id'], { unique: true })
export class ContactInstallmentAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  contact_id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  outstanding_amount: number;

  @Column({ type: 'varchar', enum: ['ACTIVE', 'COMPLETED', 'OVERDUE'], default: 'ACTIVE' })
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE';

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}
