import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, OneToMany, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Contact } from '../../contact/entities/contact.entity';

@Entity('submissions')
@Index(['organization_id', 'form_id'])
@Index('IDX_submissions_org_contact', ['organization_id', 'contact_id'])
@Index('IDX_submissions_org_created_at', ['organization_id', 'created_at'])
export class Submission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  form_id: string;

  @Column()
  organization_id: string;

  @Column({ nullable: true })
  contact_id: string;

  @Column({ type: 'json' })
  data: Record<string, any>;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.activity_logs, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Contact, contact => contact.submissions, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @OneToMany(() => Payment, payment => payment.submission)
  payments: Payment[];
}
