import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('installment_plan_items')
@Index('IDX_installment_plan_items_plan_order', ['plan_id', 'order_index'])
export class InstallmentPlanItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  plan_id: string;

  @Column({ type: 'varchar' })
  label: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'date' })
  due_date: string;

  @Column({ type: 'jsonb', nullable: true })
  penalty_rule: Record<string, unknown> | null;

  @Column({ type: 'integer', default: 0 })
  order_index: number;
}
