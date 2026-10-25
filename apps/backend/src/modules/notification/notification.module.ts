import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { ReminderAutomationService } from './services/reminder-automation.service';
import { ReminderSchedulerService } from './services/reminder-scheduler.service';
import { ReminderAutomationController } from './controllers/reminder-automation.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from '../contact/entities/contact.entity';
import { User } from '../auth/entities/user.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Payment } from '../payment/entities/payment.entity';
import { InternalNotification } from './entities/internal-notification.entity';
import { ContactNotification } from './entities/contact-notification.entity';
import { OrganizationReminderPolicy } from './entities/organization-reminder-policy.entity';
import { ReminderSendHistory } from './entities/reminder-send-history.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Contact,
      User,
      Organization,
      Payment,
      InternalNotification,
      ContactNotification,
      OrganizationReminderPolicy,
      ReminderSendHistory,
    ]),
    // Meters every tenant email send against the plan's `monthly_email_sends`.
    BillingModule,
  ],
  providers: [
    NotificationService,
    ReminderAutomationService,
    ReminderSchedulerService,
  ],
  controllers: [NotificationController, ReminderAutomationController],
  exports: [NotificationService, ReminderAutomationService, ReminderSchedulerService],
})
export class NotificationModule {}
