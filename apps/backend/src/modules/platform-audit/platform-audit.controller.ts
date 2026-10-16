import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformAuditService } from './platform-audit.service';
import { PlatformAuditLogQueryDto } from './dto/platform-audit-log-query.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';

/**
 * Read-only access to the platform audit trail. Restricted to `SUPER` platform
 * admins. Listing is a `GET`, so the platform audit interceptor intentionally
 * does not record it (no self-referential noise).
 */
@ApiTags('Platform Admin')
@Controller('platform/audit-logs')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
export class PlatformAuditController {
  constructor(private readonly platformAuditService: PlatformAuditService) {}

  @Get()
  async list(@Query() query: PlatformAuditLogQueryDto) {
    return this.platformAuditService.list(query);
  }

  /**
   * Declared before `:id` so Nest routes `GET /platform/audit-logs/actions`
   * here instead of treating "actions" as an audit-log id.
   */
  @Get('actions')
  async actions() {
    return { actions: await this.platformAuditService.distinctActions() };
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    const log = await this.platformAuditService.getById(id);
    if (!log) {
      throw new NotFoundException('Audit log entry not found');
    }
    return log;
  }
}
