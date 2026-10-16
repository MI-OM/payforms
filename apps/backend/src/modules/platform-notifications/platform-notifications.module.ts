import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PlatformNotification } from './entities/platform-notification.entity';
import { PlatformNotificationDelivery } from './entities/platform-notification-delivery.entity';
import { Organization } from '../organization/entities/organization.entity';
import { User } from '../auth/entities/user.entity';
import { NotificationModule } from '../notification/notification.module';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformNotificationsService } from './platform-notifications.service';
import { PlatformNotificationsController } from './platform-notifications.controller';

/**
 * Platform admin notifications (Part 3, Wave A, Module 4).
 *
 * Reuses the tenant `NotificationService` for the actual email transport and
 * `PlatformAuditModule` for the interceptor, mirroring the other platform
 * modules. `PlatformJwtAuthGuard`/`PlatformRolesGuard` are provided locally so
 * routes are protected even when this module is used in isolation (tests).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      PlatformNotification,
      PlatformNotificationDelivery,
      Organization,
      User,
    ]),
    NotificationModule,
    PlatformAuditModule,
  ],
  controllers: [PlatformNotificationsController],
  providers: [
    PlatformNotificationsService,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformNotificationsService],
})
export class PlatformNotificationsModule {}
