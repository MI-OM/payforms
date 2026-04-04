import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { BillingService } from './billing.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Form, Contact, ActivityLog])],
  providers: [BillingService],
  controllers: [BillingController],
  exports: [BillingService],
})
export class BillingModule {}
