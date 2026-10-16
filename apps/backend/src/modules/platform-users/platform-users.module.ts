import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../auth/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationStatusModule } from '../organization/organization-status.module';
import { PlatformUsersService } from './platform-users.service';
import { PlatformUsersController } from './platform-users.controller';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';

/**
 * Platform admin user directory (Part 3, Wave B, Module 7).
 *
 * Reads across tenant boundaries on purpose, so the service wraps its queries in
 * `OrganizationContextService.runWithoutContext(...)` — an explicit Row Level
 * Security bypass instead of the implicit system-context fallback. Only
 * `PlatformJwtAuthGuard`-protected routes reach it.
 *
 * The `platform-jwt` strategy is registered globally by `PlatformAuthModule`
 * (loaded in `AppModule`), so the guards work here without importing it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([User, Organization]),
    OrganizationStatusModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformUsersController],
  providers: [
    PlatformUsersService,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformUsersService],
})
export class PlatformUsersModule {}
