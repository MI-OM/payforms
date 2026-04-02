import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Payment } from '../../payment/entities/payment.entity';

@Entity('payment_logs')
@Index(['organization_id', 'created_at'])
@Index(['payment_id', 'event_id'], { unique: true })
export class PaymentLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  payment_id: string;

  @Column()
  event_id: string;

  @Column()
  organization_id: string;

  @Column()
  event: string;

  @Column({ type: 'json' })
  payload: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.payment_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Payment, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'payment_id' })
  payment: Payment;
}
