import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformFeatureFlagsService } from './platform-feature-flags.service';
import {
  ListFeatureFlagsQueryDto,
  ResolveFeatureFlagQueryDto,
  SetFeatureFlagOverrideDto,
  UpsertFeatureFlagDto,
} from './dto/platform-settings.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform feature flags console (Part 3, Wave A, Module 5).
 *
 * Global flags plus per-organization overrides. Reads (`GET`, including the
 * `resolve` preview) are not audited; every mutation is.
 */
@ApiTags('Platform Admin')
@Controller('platform/feature-flags')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformFeatureFlagsController {
  constructor(
    private readonly platformFeatureFlagsService: PlatformFeatureFlagsService,
  ) {}

  @Get()
  async list(@Query() query: ListFeatureFlagsQueryDto) {
    return this.platformFeatureFlagsService.list(query);
  }

  @Get(':key')
  async detail(@Param('key') key: string) {
    return this.platformFeatureFlagsService.detail(key);
  }

  @Get(':key/resolve')
  async resolve(
    @Param('key') key: string,
    @Query() query: ResolveFeatureFlagQueryDto,
  ) {
    return this.platformFeatureFlagsService.resolve(key, query.organization_id);
  }

  @Put(':key')
  @PlatformAuditAction('SET FEATURE FLAG', 'FeatureFlag')
  async upsert(
    @Param('key') key: string,
    @Body() dto: UpsertFeatureFlagDto,
    @Request() req: any,
  ) {
    return this.platformFeatureFlagsService.upsert(key, dto, req.user);
  }

  @Delete(':key')
  @PlatformAuditAction('DELETE FEATURE FLAG', 'FeatureFlag')
  async remove(@Param('key') key: string) {
    return this.platformFeatureFlagsService.remove(key);
  }

  @Put(':key/organizations/:organizationId')
  @PlatformAuditAction('SET FEATURE FLAG OVERRIDE', 'FeatureFlagOverride')
  async setOverride(
    @Param('key') key: string,
    @Param('organizationId') organizationId: string,
    @Body() dto: SetFeatureFlagOverrideDto,
    @Request() req: any,
  ) {
    return this.platformFeatureFlagsService.setOverride(
      key,
      organizationId,
      dto,
      req.user,
    );
  }

  @Delete(':key/organizations/:organizationId')
  @PlatformAuditAction('CLEAR FEATURE FLAG OVERRIDE', 'FeatureFlagOverride')
  async clearOverride(
    @Param('key') key: string,
    @Param('organizationId') organizationId: string,
  ) {
    return this.platformFeatureFlagsService.clearOverride(key, organizationId);
  }
}
