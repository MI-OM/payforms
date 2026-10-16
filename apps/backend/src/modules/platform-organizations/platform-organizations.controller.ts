import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformOrganizationsService } from './platform-organizations.service';
import {
  ChangeOrganizationStatusDto,
  ListOrganizationStatusEventsQueryDto,
  ListPlatformOrganizationsQueryDto,
} from './dto/platform-organizations.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform admin organization console (Part 3, Wave A, Module 3).
 *
 * Reads are `GET` and therefore not written to the audit trail; the status
 * mutation is explicitly annotated so the hard stop is always attributable.
 */
@ApiTags('Platform Admin')
@Controller('platform/organizations')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformOrganizationsController {
  constructor(
    private readonly platformOrganizationsService: PlatformOrganizationsService,
  ) {}

  @Get()
  async list(@Query() query: ListPlatformOrganizationsQueryDto) {
    return this.platformOrganizationsService.list(query);
  }

  @Get('stats')
  async stats() {
    return this.platformOrganizationsService.stats();
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.platformOrganizationsService.detail(id);
  }

  @Patch(':id/status')
  @PlatformAuditAction('UPDATE ORGANIZATION STATUS', 'Organization')
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeOrganizationStatusDto,
    @Request() req: any,
  ) {
    return this.platformOrganizationsService.changeStatus(id, dto, req.user);
  }

  @Get(':id/usage')
  async usage(@Param('id') id: string) {
    return this.platformOrganizationsService.usage(id);
  }

  @Get(':id/status-events')
  async statusEvents(
    @Param('id') id: string,
    @Query() query: ListOrganizationStatusEventsQueryDto,
  ) {
    return this.platformOrganizationsService.listStatusEvents(id, query);
  }
}
