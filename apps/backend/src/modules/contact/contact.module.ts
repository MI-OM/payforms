import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contact } from './entities/contact.entity';
import { ContactImport } from './entities/contact-import.entity';
import { Group } from '../group/entities/group.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ContactService } from './services/contact.service';
import { ContactImportService } from './services/contact-import.service';
import { ContactController } from './controllers/contact.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Contact, ContactImport, Group, Payment, Submission])],
  controllers: [ContactController],
  providers: [ContactService, ContactImportService],
  exports: [ContactService],
})
export class ContactModule {}
