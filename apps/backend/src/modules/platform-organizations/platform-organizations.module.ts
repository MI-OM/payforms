import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { OrganizationStatusEvent } from '../organization/entities/organization-status-event.entity';
import { OrganizationStatusModule } from '../organization/organization-status.module';
import { User } from '../auth/entities/user.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Form } from '../form/entities/form.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Payment } from '../payment/entities/payment.entity';
import { PlatformOrganizationsService } from './platform-organizations.service';
import { PlatformOrganizationsController } from './platform-organizations.controller';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformAuditModule } from '../platform-audit/platform-audit.module';

/**
 * Platform admin organization console (Part 3, Wave A, Module 3).
 *
 * The counts projector needs read access to the tenant-scoped entities, but it
 * scopes every query through `OrganizationContextService.runWithContext`, so Row
 * Level Security still restricts each count to the target organization.
 *
 * The `platform-jwt` strategy is registered globally by `PlatformAuthModule`
 * (loaded in `AppModule`), so the guards work here without importing it.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      OrganizationStatusEvent,
      User,
      Contact,
      Form,
      Submission,
      Payment,
    ]),
    OrganizationStatusModule,
    // Provides+exports PlatformAuditInterceptor for @UseInterceptors on the
    // controller, mirroring PlatformAuthModule.
    PlatformAuditModule,
  ],
  controllers: [PlatformOrganizationsController],
  providers: [
    PlatformOrganizationsService,
    PlatformJwtAuthGuard,
    PlatformRolesGuard,
  ],
  exports: [PlatformOrganizationsService],
})
export class PlatformOrganizationsModule {}
