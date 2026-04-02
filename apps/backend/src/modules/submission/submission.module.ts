import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Submission } from './entities/submission.entity';
import { SubmissionService } from './services/submission.service';
import { PublicController } from './controllers/public.controller';
import { FormModule } from '../form/form.module';
import { PaymentModule } from '../payment/payment.module';
import { ContactModule } from '../contact/contact.module';
import { ContactAuthModule } from '../contact-auth/contact-auth.module';
import { NotificationModule } from '../notification/notification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Submission]),
    FormModule,
    PaymentModule,
    ContactModule,
    ContactAuthModule,
    NotificationModule,
  ],
  controllers: [PublicController],
  providers: [SubmissionService],
  exports: [SubmissionService],
})
export class SubmissionModule {}
