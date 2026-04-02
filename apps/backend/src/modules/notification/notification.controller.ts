import { Controller, Post, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import { ReminderNotificationDto, ScheduleNotificationDto } from './dto/notification.dto';
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

  @Post('schedule')
  async schedule(@Body() dto: ScheduleNotificationDto) {
    // For MVP, schedule immediately.
    return this.notificationService.sendEmail(dto.recipients, dto.subject, dto.body);
  }
}
