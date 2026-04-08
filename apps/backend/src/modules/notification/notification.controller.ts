import { Controller, Post, Body, UseGuards, Request, Get, Query, Patch, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  ReminderNotificationDto,
  GroupReminderNotificationDto,
  ScheduleNotificationDto,
  GroupScheduleNotificationDto,
  CreateInternalNotificationDto,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  @Post('reminder')
  async sendReminder(@Body() dto: ReminderNotificationDto, @Request() req) {
    const message = dto.message || 'Please complete your payment as soon as possible.';
    const recipients = await Promise.all(
      dto.contact_ids.map(contactId =>
        this.notificationService.getContactEmail(req.user.organization_id, contactId),
      ),
    );

    const filtered = recipients.filter((email): email is string => !!email);
    return this.notificationService.sendReminder(filtered, message);
  }

  @Post('reminder/groups')
  async sendGroupReminder(@Body() dto: GroupReminderNotificationDto, @Request() req) {
    const message = dto.message || 'Please complete your payment as soon as possible.';
    const recipients = await this.notificationService.getGroupContactEmails(
      req.user.organization_id,
      dto.group_ids,
    );

    return this.notificationService.sendReminder(recipients, message);
  }

  @Post('schedule')
  async schedule(@Body() dto: ScheduleNotificationDto) {
    // For MVP, schedule immediately.
    return this.notificationService.sendEmail(dto.recipients, dto.subject, dto.body);
  }

  @Post('schedule/groups')
  async scheduleByGroups(@Body() dto: GroupScheduleNotificationDto, @Request() req) {
    const recipients = await this.notificationService.getGroupContactEmails(
      req.user.organization_id,
      dto.group_ids,
    );

    return this.notificationService.sendEmail(recipients, dto.subject, dto.body);
  }

  @Get('scheduled')
  async getScheduledNotifications(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    // For MVP, return empty list as scheduling is immediate
    return {
      data: [],
      total: 0,
      page,
      limit,
    };
  }

  @Post('internal')
  async createInternalNotification(@Body() dto: CreateInternalNotificationDto, @Request() req) {
    return this.notificationService.createInternalNotification(
      req.user.organization_id,
      req.user.id,
      dto,
    );
  }

  @Get('internal')
  async getInternalNotifications(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.notificationService.listInternalNotifications(
      req.user.organization_id,
      req.user.id,
      Number(page),
      Number(limit),
      unreadOnly === 'true',
    );
  }

  @Patch('internal/:id/read')
  async markInternalNotificationRead(@Param('id') id: string, @Request() req) {
    return this.notificationService.markInternalNotificationRead(
      req.user.organization_id,
      req.user.id,
      id,
    );
  }
}
