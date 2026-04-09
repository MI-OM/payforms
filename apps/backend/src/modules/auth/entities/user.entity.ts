import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';

@Entity('users')
@Index(['organization_id', 'email'], { unique: true })
@Index('IDX_users_password_reset_token', ['password_reset_token'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  organization_id: string;

  @Column()
  email: string;

  @Column({ type: 'varchar', nullable: true })
  first_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  middle_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  last_name: string | null;

  @Column({ type: 'varchar', nullable: true })
  title: string | null;

  @Column({ type: 'varchar', nullable: true })
  designation: string | null;

  @Column()
  password_hash: string;

  @Column({ type: 'varchar', enum: ['ADMIN', 'STAFF'] })
  role: 'ADMIN' | 'STAFF';

  @Column({ type: 'varchar', nullable: true })
  refresh_token_hash: string | null;

  @Column({ type: 'varchar', nullable: true })
  password_reset_token: string | null;

  @Column({ type: 'timestamp', nullable: true })
  password_reset_expires_at: Date | null;

  @Column({ type: 'boolean', default: false, select: false })
  two_factor_enabled: boolean;

  @Column({ type: 'text', nullable: true, select: false })
  two_factor_secret: string | null;

  @Column({ type: 'text', nullable: true, select: false })
  two_factor_temp_secret: string | null;

  @Column({ type: 'timestamp', nullable: true, select: false })
  two_factor_temp_expires_at: Date | null;

  @Column({ type: 'text', nullable: true, select: false })
  two_factor_recovery_codes: string | null;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => Organization, org => org.users, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;
}
