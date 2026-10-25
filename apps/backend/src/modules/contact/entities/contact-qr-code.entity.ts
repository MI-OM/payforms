import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { Organization } from '../../organization/entities/organization.entity';
import { Contact } from './contact.entity';
import { QrCodeScan } from './qr-code-scan.entity';

/**
 * QR Code metadata for a contact.
 *
 * Purpose:
 * - Each contact gets a unique, persistent QR code that encodes a secure token
 * - The token enables dynamic, secure access to payment status without exposing contact data in URL
 * - Supports multiple access modes: public (no auth), authenticated (contact login), staff (school staff scan)
 *
 * Design:
 * - One QR code per contact (unique per org/contact pair)
 * - Token is stable across regens (doesn't change unless explicitly regenerated)
 * - Token is cryptographically random (256-bit entropy, URL-safe base64)
 * - Can be disabled without deletion (soft disable)
 *
 * Usage Flow:
 * 1. Contact/Staff scans QR code from physical card/document
 * 2. QR contains URL like: https://payforms.com.ng/qr/{qr_token}
 * 3. Frontend redirects to appropriate view based on context:
 *    - Public: POST /qr/view/public/{qr_token} -> see status without auth
 *    - Authenticated: POST /qr/view/authenticated/{qr_token} -> contact logs in, sees details
 *    - Staff: POST /qr/scan/{qr_token} -> staff authenticated, sees contact details
 * 4. Each access logged to qr_code_scans for audit trail
 */
@Entity('contact_qr_codes')
@Index(['organization_id', 'contact_id'], { unique: true })
@Index(['qr_token'], { unique: true })
@Index(['organization_id', 'is_active'])
export class ContactQrCode {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  organization_id: string;

  /**
   * The contact this QR code represents.
   * One-to-one relationship: each contact has exactly one active QR code.
   */
  @Column('uuid', { unique: true })
  contact_id: string;

  /**
   * Cryptographically random token (URL-safe base64).
   * Minimum 32 bytes of entropy (encode to ~43 base64 chars).
   * Used in URL like: /qr/{qr_token}
   *
   * Generate with: crypto.randomBytes(32).toString('base64url')
   */
  @Column('varchar')
  qr_token: string;

  /**
   * Whether this QR code is active and accessible.
   * If false, all access attempts are rejected.
   * Allows soft-disable without deleting history.
   */
  @Column('boolean', { default: true })
  is_active: boolean;

  @CreateDateColumn()
  created_at: Date;

  /**
   * When the token was last regenerated.
   * Null if never regenerated (original token).
   * Used for security: if contact suspects compromise, can regenerate token.
   */
  @Column('timestamp', { nullable: true })
  regenerated_at: Date | null;

  // Relations
  @ManyToOne(() => Organization, org => org.id, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization: Organization;

  @ManyToOne(() => Contact, contact => contact.qr_code, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'contact_id' })
  contact: Contact;

  @OneToMany(() => QrCodeScan, scan => scan.qr_code)
  scans: QrCodeScan[];
}
