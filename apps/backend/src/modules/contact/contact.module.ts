import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { Contact } from './entities/contact.entity';
import { ContactImport } from './entities/contact-import.entity';
import { ContactImportTemplate } from './entities/contact-import-template.entity';
import { ContactImportJobApplication } from './entities/contact-import-job-application.entity';
import { ContactQrCode } from './entities/contact-qr-code.entity';
import { QrCodeScan } from './entities/qr-code-scan.entity';
import { Group } from '../group/entities/group.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Organization } from '../organization/entities/organization.entity';
import { ContactService } from './services/contact.service';
import { ContactImportService } from './services/contact-import.service';
import { ContactImportTemplateService } from './services/contact-import-template.service';
import { ContactQrCodeService } from './services/contact-qr-code.service';
import { ContactController } from './controllers/contact.controller';
import { ContactImportTemplateController } from './controllers/contact-import-template.controller';
import { ContactQrCodeController } from './controllers/contact-qr-code.controller';
import { NotificationModule } from '../notification/notification.module';
import { BillingModule } from '../billing/billing.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Contact,
      ContactImport,
      ContactImportTemplate,
      ContactImportJobApplication,
      ContactQrCode,
      QrCodeScan,
      Group,
      Payment,
      Submission,
      Organization,
    ]),
    NotificationModule,
    // Enforces the plan's `contacts` hard limit on create/import.
    BillingModule,
  ],
  controllers: [ContactController, ContactImportTemplateController, ContactQrCodeController],
  providers: [ContactService, ContactImportService, ContactImportTemplateService, ContactQrCodeService],
  exports: [ContactService, ContactImportTemplateService, ContactQrCodeService],
})
export class ContactModule {}
