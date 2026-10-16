import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformUsersService } from './platform-users.service';
import {
  ChangeUserStatusDto,
  ListPlatformUsersQueryDto,
  ResetUserTwoFactorDto,
} from './dto/platform-users.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform admin user directory (Part 3, Wave B, Module 7).
 *
 * Reads are `GET` and therefore not written to the audit trail; disabling a
 * user and resetting their two-factor state are explicitly annotated so those
 * support actions are always attributable.
 */
@ApiTags('Platform Admin')
@Controller('platform/users')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformUsersController {
  constructor(private readonly platformUsersService: PlatformUsersService) {}

  @Get()
  async list(@Query() query: ListPlatformUsersQueryDto) {
    return this.platformUsersService.list(query);
  }

  @Get(':id')
  async detail(@Param('id') id: string) {
    return this.platformUsersService.detail(id);
  }

  @Patch(':id/status')
  @PlatformAuditAction('UPDATE USER STATUS', 'User')
  async changeStatus(
    @Param('id') id: string,
    @Body() dto: ChangeUserStatusDto,
    @Request() req: any,
  ) {
    return this.platformUsersService.changeStatus(id, dto, req.user);
  }

  // Nothing is created, so answer 200 instead of Nest's default POST 201.
  @Post(':id/reset-2fa')
  @HttpCode(200)
  @PlatformAuditAction('RESET USER TWO FACTOR', 'User')
  async resetTwoFactor(
    @Param('id') id: string,
    @Body() dto: ResetUserTwoFactorDto,
    @Request() req: any,
  ) {
    return this.platformUsersService.resetTwoFactor(id, dto, req.user);
  }
}
