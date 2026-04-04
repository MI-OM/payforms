import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Contact, Submission, ActivityLog])],
  providers: [ComplianceService],
  controllers: [ComplianceController],
  exports: [ComplianceService],
})
export class ComplianceModule {}
