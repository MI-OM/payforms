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
import { PlatformSettingsService } from './platform-settings.service';
import {
  ListPlatformSettingsQueryDto,
  SetPlatformSettingDto,
} from './dto/platform-settings.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform settings console (Part 3, Wave A, Module 5).
 *
 * Reads are `GET` and not audited; writes are annotated. `is_secret` values are
 * never returned, so this controller is safe to expose to SUPER operators.
 */
@ApiTags('Platform Admin')
@Controller('platform/settings')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformSettingsController {
  constructor(private readonly platformSettingsService: PlatformSettingsService) {}

  @Get()
  async list(@Query() query: ListPlatformSettingsQueryDto) {
    return this.platformSettingsService.list(query);
  }

  @Get(':key')
  async get(@Param('key') key: string) {
    return this.platformSettingsService.get(key);
  }

  @Put(':key')
  @PlatformAuditAction('SET PLATFORM SETTING', 'PlatformSetting')
  async set(
    @Param('key') key: string,
    @Body() dto: SetPlatformSettingDto,
    @Request() req: any,
  ) {
    return this.platformSettingsService.set(key, dto, req.user);
  }

  @Delete(':key')
  @PlatformAuditAction('DELETE PLATFORM SETTING', 'PlatformSetting')
  async remove(@Param('key') key: string) {
    return this.platformSettingsService.remove(key);
  }
}
