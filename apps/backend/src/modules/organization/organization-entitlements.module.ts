import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrganizationEntitlementOverride } from './entities/organization-entitlement-override.entity';
import { OrganizationEntitlementsService } from './organization-entitlements.service';

/**
 * Manual per-organization entitlement overrides (Part 3, Module 8).
 * Dependency-light so both the tenant billing path and the platform console
 * can import it without cycles.
 */
@Module({
  imports: [TypeOrmModule.forFeature([OrganizationEntitlementOverride])],
  providers: [OrganizationEntitlementsService],
  exports: [OrganizationEntitlementsService],
})
export class OrganizationEntitlementsModule {}
