import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Organization } from '../organization/entities/organization.entity';
import { PaymentLog } from '../audit/entities/payment-log.entity';
import { Form } from '../form/entities/form.entity';
import { User } from '../auth/entities/user.entity';
import { PaymentService } from './services/payment.service';
import { PaymentController } from './controllers/payment.controller';
import { TransactionsController } from './controllers/transactions.controller';
import { WebhookController } from './controllers/webhook.controller';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentLog, Submission, Contact, Organization, Form, User]),
    NotificationModule,
  ],
  controllers: [PaymentController, TransactionsController, WebhookController],
  providers: [PaymentService],
  exports: [PaymentService],
})
export class PaymentModule {}
