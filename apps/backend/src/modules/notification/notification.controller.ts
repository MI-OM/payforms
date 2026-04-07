import { Controller, Post, Body, UseGuards, Request, Get, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  ReminderNotificationDto,
  GroupReminderNotificationDto,
  ScheduleNotificationDto,
  GroupScheduleNotificationDto,
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
}
