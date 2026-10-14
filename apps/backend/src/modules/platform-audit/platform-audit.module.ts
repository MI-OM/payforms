import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformAuditLog } from './entities/platform-audit-log.entity';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuditInterceptor } from './platform-audit.interceptor';
import { PlatformAuditController } from './platform-audit.controller';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';

/**
 * Platform admin audit module (Part 3, Wave A, Module 2).
 *
 * Exports `PlatformAuditInterceptor` (and the service) so other platform
 * modules can attach it with `@UseInterceptors(PlatformAuditInterceptor)`.
 *
 * The `platform-jwt` passport strategy that backs `PlatformJwtAuthGuard` is
 * registered globally by `PlatformAuthModule` (loaded in `AppModule`), so the
 * guard works here without importing that module.
 */
@Module({
  imports: [TypeOrmModule.forFeature([PlatformAuditLog])],
  controllers: [PlatformAuditController],
  providers: [
    PlatformAuditService,
    PlatformAuditInterceptor,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformAuditService, PlatformAuditInterceptor],
})
export class PlatformAuditModule {}
