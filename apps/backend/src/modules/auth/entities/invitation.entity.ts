import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('invitations')
@Index(['organization_id', 'email'], { unique: true })
export class Invitation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  designation: string | null;

  @Column({ type: 'varchar', enum: ['ADMIN', 'STAFF'], default: 'STAFF' })
  role: 'ADMIN' | 'STAFF';

  @Column()
  token: string;

  @Column({ nullable: true })
  invited_by?: string;

  @Column({ type: 'boolean', default: false })
  accepted: boolean;

  @Column({ type: 'timestamp', nullable: true })
  accepted_at: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  expires_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @ManyToOne(() => Organization, org => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
