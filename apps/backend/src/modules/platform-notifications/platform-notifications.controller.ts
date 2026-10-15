import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformNotificationsService } from './platform-notifications.service';
import {
  ComposePlatformNotificationDto,
  ListPlatformNotificationDeliveriesQueryDto,
  ListPlatformNotificationsQueryDto,
  NotifyOrganizationDto,
} from './dto/platform-notifications.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Platform admin notifications composer (Part 3, Wave A, Module 4).
 *
 * Broadcasts (ALL / SEGMENT) and single-organization messages. Reads are `GET`
 * and not audited; sends are annotated so every outbound communication is
 * attributable to a platform operator.
 *
 * The single-organization route lives here (rather than in the organizations
 * controller) so Module 3 stays free of a dependency on this module.
 */
@ApiTags('Platform Admin')
@Controller('platform')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformNotificationsController {
  constructor(
    private readonly platformNotificationsService: PlatformNotificationsService,
  ) {}

  @Post('notifications')
  @PlatformAuditAction('SEND PLATFORM NOTIFICATION', 'PlatformNotification')
  async compose(
    @Body() dto: ComposePlatformNotificationDto,
    @Request() req: any,
  ) {
    return this.platformNotificationsService.compose(dto, req.user);
  }

  @Get('notifications')
  async list(@Query() query: ListPlatformNotificationsQueryDto) {
    return this.platformNotificationsService.list(query);
  }

  @Get('notifications/:id')
  async detail(
    @Param('id') id: string,
    @Query() query: ListPlatformNotificationDeliveriesQueryDto,
  ) {
    return this.platformNotificationsService.detail(id, query);
  }

  @Post('organizations/:id/notify')
  @PlatformAuditAction('NOTIFY ORGANIZATION', 'Organization')
  async notifyOrganization(
    @Param('id') id: string,
    @Body() dto: NotifyOrganizationDto,
    @Request() req: any,
  ) {
    return this.platformNotificationsService.notifyOrganization(id, dto, req.user);
  }
}
