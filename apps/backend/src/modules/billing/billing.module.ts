import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { User } from '../auth/entities/user.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { OrganizationUsageEvent } from './entities/organization-usage-event.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';
import { OrganizationEntitlementsModule } from '../organization/organization-entitlements.module';

/**
 * Exports `BillingService` so the tenant write paths (forms, contacts, staff
 * seats, submissions, email, storage) can enforce plan limits at the point of
 * persistence. Only entity classes are imported from those modules — never
 * their modules — so this introduces no dependency cycle.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Organization,
      Form,
      Contact,
      User,
      Submission,
      ActivityLog,
      OrganizationUsageEvent,
    ]),
    OrganizationEntitlementsModule,
  ],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
