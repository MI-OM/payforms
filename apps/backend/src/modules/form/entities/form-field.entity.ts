import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Form } from './form.entity';

@Entity('form_fields')
@Index(['form_id', 'order_index'])
export class FormField {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  form_id: string;

  @Column()
  label: string;

  @Column({ type: 'varchar', enum: ['TEXT', 'EMAIL', 'SELECT', 'NUMBER', 'TEXTAREA'] })
  type: 'TEXT' | 'EMAIL' | 'SELECT' | 'NUMBER' | 'TEXTAREA';

  @Column({ type: 'boolean', default: false })
  required: boolean;

  @Column({ type: 'json', nullable: true })
  options: string[];

  @Column({ type: 'int' })
  order_index: number;

  @Column({ type: 'json', nullable: true })
  validation_rules: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Form, form => form.fields, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form: Form;
}
