import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportController } from './controllers/report.controller';
import { ReportService } from './services/report.service';
import { Form } from '../form/entities/form.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Group } from '../group/entities/group.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Form, Submission, Payment, Contact, Group])],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
