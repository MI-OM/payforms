import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContactQrCode } from './contact-qr-code.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Contact } from './contact.entity';
import { User } from '../../auth/entities/user.entity';

/**
 * Audit trail of QR code scans.
 *
 * Purpose:
 * - Track who scanned the QR code, when, and from where
 * - Compliance and auditing: see who accessed payment information
 * - Analytics: how often do staff/contacts check payment status
 * - Security: detect suspicious patterns
 *
 * Access modes:
 * - "public": QR scanned without authentication (no login required)
 * - "authenticated": Contact logged in to view their own QR
 * - "staff": School staff member scanned to check contact payment status
 *
 * Lifecycle:
 * - Created every time a QR code is accessed (read-only audit trail)
 * - Never updated or deleted
 * - Retention governed by organization's data retention policy
 */
@Entity('qr_code_scans')
@Index(['qr_code_id'])
@Index(['contact_id'])
@Index(['scanned_by_user_id'])
@Index(['organization_id', 'contact_id', 'scanned_at'])
export class QrCodeScan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Reference to the QR code that was scanned.
   */
  @Column('uuid')
  qr_code_id: string;

  /**
   * Organization that owns this QR code.
   * Denormalized for fast queries and access control.
   */
  @Column('uuid')
  organization_id: string;

  /**
   * Contact whose QR code was scanned.
   * Denormalized for audit trail.
   */
  @Column('uuid')
  contact_id: string;

  /**
   * Staff/admin who performed the scan.
   * Null if scanned by the contact themselves or publicly.
   */
  @Column('uuid', { nullable: true })
  scanned_by_user_id: string | null;

  /**
   * How the QR code was accessed.
   */
  @Column({ type: 'varchar', enum: ['public', 'authenticated', 'staff'] })
  access_mode: 'public' | 'authenticated' | 'staff';

  /**
   * IP address of the scanner.
   * Captured for security auditing (detect unusual access patterns).
   */
  @Column('varchar', { nullable: true })
  ip_address: string | null;

  /**
   * Browser/device user agent string.
   * Captured for analytics and security analysis.
   */
  @Column('text', { nullable: true })
  user_agent: string | null;

  @CreateDateColumn()
  scanned_at: Date;

  // Relations
  @ManyToOne(() => ContactQrCode, qr => qr.scans, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'qr_code_id' })
  qr_code: ContactQrCode;

  @ManyToOne(() => Organization, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Contact, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'scanned_by_user_id' })
  scanned_by: User | null;
}
