import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformSetting } from './entities/platform-setting.entity';
import { PlatformFeatureFlag } from './entities/platform-feature-flag.entity';
import { PlatformFeatureFlagOverride } from './entities/platform-feature-flag-override.entity';
import { Organization } from '../organization/entities/organization.entity';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformSettingsService } from './platform-settings.service';
import { PlatformSettingsController } from './platform-settings.controller';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';
import { PlatformFeatureFlagsController } from './platform-feature-flags.controller';

/**
 * Platform settings + feature flags (Part 3, Wave A, Module 5).
 *
 * Two services share the module: typed global settings and feature flags with
 * per-organization overrides. `PlatformFeatureFlagsService` is exported so other
 * modules can gate behaviour via `isEnabled(key, organizationId)` without
 * reaching into the database themselves.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformSetting,
      PlatformFeatureFlag,
      PlatformFeatureFlagOverride,
      Organization,
    ]),
    PlatformAuditModule,
  ],
  controllers: [PlatformSettingsController, PlatformFeatureFlagsController],
  providers: [
    PlatformSettingsService,
    PlatformFeatureFlagsService,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformSettingsService, PlatformFeatureFlagsService],
})
export class PlatformSettingsModule {}
