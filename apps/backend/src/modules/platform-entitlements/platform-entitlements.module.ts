import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationEntitlementsModule } from '../organization/organization-entitlements.module';
import { BillingModule } from '../billing/billing.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PlatformEntitlementsController, PlatformPlansController } from './platform-entitlements.controller';
import { PlatformEntitlementsService } from './platform-entitlements.service';

/**
 * Manual per-organization entitlements console (Part 3, Module 8).
 * Imports the light OrganizationEntitlementsModule for overrides and
 * BillingModule for the plan defaults (no cycle: Billing → Entitlements core).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Organization]),
    OrganizationEntitlementsModule,
    BillingModule,
    // Provides+exports PlatformAuditInterceptor for @UseInterceptors on the
    // controller, mirroring PlatformOrganizationsModule.
    PlatformAuditModule,
  ],
  controllers: [PlatformEntitlementsController, PlatformPlansController],
  providers: [PlatformEntitlementsService],
})
export class PlatformEntitlementsModule {}
