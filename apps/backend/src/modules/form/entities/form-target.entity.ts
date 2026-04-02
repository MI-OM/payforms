import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Form } from './form.entity';

@Entity('form_targets')
@Index(['form_id', 'target_type', 'target_id'], { unique: true })
export class FormTarget {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  form_id: string;

  @Column({ type: 'varchar', enum: ['group', 'contact'] })
  target_type: 'group' | 'contact';

  @Column()
  target_id: string;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Form, form => form.targets, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'form_id' })
  form: Form;
}
