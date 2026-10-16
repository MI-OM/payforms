import { Module } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from '../contact/entities/contact.entity';
import { User } from '../auth/entities/user.entity';
import { InternalNotification } from './entities/internal-notification.entity';
import { ContactNotification } from './entities/contact-notification.entity';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Contact, User, InternalNotification, ContactNotification]),
    // Meters every tenant email send against the plan's `monthly_email_sends`.
    BillingModule,
  ],
  providers: [NotificationService],
  controllers: [NotificationController],
  exports: [NotificationService],
})
export class NotificationModule {}
