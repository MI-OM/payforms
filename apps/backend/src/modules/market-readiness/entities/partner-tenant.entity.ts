import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export type PartnerTenantOnboardingStatus = 'PENDING' | 'ACTIVE' | 'PAUSED';

@Entity('partner_tenants')
@Index('IDX_partner_tenants_partner_created', ['partner_id', 'created_at'])
@Index('IDX_partner_tenants_org_status', ['organization_id', 'onboarding_status'])
@Index('UQ_partner_tenants_partner_tenant_org', ['partner_id', 'tenant_organization_id'], { unique: true })
export class PartnerTenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  organization_id: string;

  @Column({ type: 'uuid' })
  partner_id: string;

  @Column({ type: 'uuid' })
  tenant_organization_id: string;

  @Column({ type: 'varchar', enum: ['PENDING', 'ACTIVE', 'PAUSED'], default: 'PENDING' })
  onboarding_status: PartnerTenantOnboardingStatus;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ type: 'timestamp' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp' })
  updated_at: Date;
}