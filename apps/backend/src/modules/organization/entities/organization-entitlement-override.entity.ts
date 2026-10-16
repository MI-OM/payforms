import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Manual per-organization entitlement overrides (Part 3, Module 8).
 *
 * Interim control-plane tool while full billing (Part 1 plan catalog +
 * subscriptions) is being decided: a platform operator negotiates terms with an
 * organization and sets its real limits from the platform console. Each column
 * mirrors a key in `BillingService`'s plan limits (`soft_limits` /
 * `hard_limits`). A NULL column means "inherit the plan default"; a set column
 * replaces BOTH the soft and hard limit for that metric (the negotiated number
 * is the deal).
 *
 * Control-plane table: intentionally NOT part of the tenant RLS policy set
 * (see `EnforceRLSPolicies1777300000000`). Only platform routes write it; the
 * tenant billing read path merges it into the plan response.
 */
@Entity('organization_entitlement_overrides')
@Index('IDX_org_entitlement_overrides_org_unique', ['organization_id'], { unique: true })
export class OrganizationEntitlementOverride {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  /** Billing key: `contacts`. */
  @Column({ type: 'int', nullable: true })
  contacts_limit: number | null;

  /** Billing key: `forms`. */
  @Column({ type: 'int', nullable: true })
  forms_limit: number | null;

  /** Billing key: `staff_users`. */
  @Column({ type: 'int', nullable: true })
  staff_users_limit: number | null;

  /** Billing key: `monthly_submissions`. */
  @Column({ type: 'int', nullable: true })
  monthly_submissions_limit: number | null;

  /** Billing key: `monthly_email_sends`. */
  @Column({ type: 'int', nullable: true })
  monthly_email_sends_limit: number | null;

  /** Billing key: `storage_gb`. */
  @Column({ type: 'int', nullable: true })
  storage_gb_limit: number | null;

  /** Free-text note about the negotiated deal (visible to operators). */
  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'uuid', nullable: true })
  set_by_platform_user_id: string | null;

  @Column({ type: 'varchar', length: 320, nullable: true })
  set_by_email: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}
