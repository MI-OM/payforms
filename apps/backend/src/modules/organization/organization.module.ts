import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationService } from './services/organization.service';
import { OrganizationController } from './controllers/organization.controller';
import { StorageModule } from '../storage/storage.module';
import { User } from '../auth/entities/user.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Form } from '../form/entities/form.entity';
import { Payment } from '../payment/entities/payment.entity';
import { BillingModule } from '../billing/billing.module';
import { OrganizationEntitlementsModule } from './organization-entitlements.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Organization, User, Contact, Form, Payment]),
    StorageModule,
    // Enforces and meters the plan's `storage_gb` hard limit on uploads.
    BillingModule,
    // Resolves negotiated entitlement overrides for GET /organization/entitlements.
    OrganizationEntitlementsModule,
  ],
  controllers: [OrganizationController],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
