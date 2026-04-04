import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import { TenantResolverService } from './tenant-resolver.service';
import { TenantGuard } from './guards/tenant.guard';

@Module({
  imports: [TypeOrmModule.forFeature([Organization, ActivityLog])],
  providers: [TenantResolverService, TenantGuard],
  exports: [TenantResolverService, TenantGuard],
})
export class TenantResolverModule {}
