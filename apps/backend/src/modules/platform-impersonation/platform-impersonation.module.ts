import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ImpersonationSession } from './entities/impersonation-session.entity';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../auth/entities/user.entity';
import { PlatformSettingsModule } from '../platform-settings/platform-settings.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformImpersonationService } from './platform-impersonation.service';
import { PlatformImpersonationController } from './platform-impersonation.controller';
import { NotificationModule } from '../notification/notification.module';

/**
 * Platform impersonation (Part 3, Wave B item 9 — IN v1).
 *
 * Registers its own `JwtModule` bound to the TENANT `JWT_SECRET` so the tokens
 * it mints are accepted by the existing tenant `JwtStrategy` (and by nothing
 * else — the platform strategy uses a separate secret). It depends on
 * `PlatformSettingsModule` only to read the impersonation feature-flag kill
 * switch, and on `PlatformAuditModule` for the audit interceptor.
 *
 * The reverse integration — the tenant auth path validating a session — is done
 * by injecting the `ImpersonationSession` repository into `AuthService`, which
 * keeps the module graph acyclic.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([ImpersonationSession, Organization, User]),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
      }),
    }),
    PlatformSettingsModule,
    PlatformAuditModule,
    NotificationModule,
  ],
  controllers: [PlatformImpersonationController],
  providers: [
    PlatformImpersonationService,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformImpersonationService],
})
export class PlatformImpersonationModule {}
