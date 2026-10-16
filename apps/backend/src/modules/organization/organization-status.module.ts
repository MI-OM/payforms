import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from './entities/organization.entity';
import { OrganizationStatusEvent } from './entities/organization-status-event.entity';
import { OrganizationStatusService } from './services/organization-status.service';

/**
 * Lightweight module exposing the organization "hard stop" check
 * (Part 3, Wave A, Module 3).
 *
 * Kept separate from `OrganizationModule` so that hot paths (tenant auth, public
 * payment forms) can enforce the hard stop without importing the heavier
 * organization module (storage, contacts, forms, payments).
 */
@Module({
  imports: [TypeOrmModule.forFeature([Organization, OrganizationStatusEvent])],
  providers: [OrganizationStatusService],
  exports: [OrganizationStatusService],
})
export class OrganizationStatusModule {}
