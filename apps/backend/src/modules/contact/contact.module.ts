import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { ContactImport } from './entities/contact-import.entity';
import { ContactImportTemplate } from './entities/contact-import-template.entity';
import { ContactImportJobApplication } from './entities/contact-import-job-application.entity';
import { Group } from '../group/entities/group.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Organization } from '../organization/entities/organization.entity';
import { ContactService } from './services/contact.service';
import { ContactImportService } from './services/contact-import.service';
import { ContactImportTemplateService } from './services/contact-import-template.service';
import { ContactController } from './controllers/contact.controller';
import { ContactImportTemplateController } from './controllers/contact-import-template.controller';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contact,
      ContactImport,
      ContactImportTemplate,
      ContactImportJobApplication,
      Group,
      Payment,
      Submission,
      Organization,
    ]),
    NotificationModule,
    // Enforces the plan's `contacts` hard limit on create/import.
    BillingModule,
  ],
  controllers: [ContactController, ContactImportTemplateController],
  providers: [ContactService, ContactImportService, ContactImportTemplateService],
  exports: [ContactService, ContactImportTemplateService],
})
export class ContactModule {}
