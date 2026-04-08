import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { NotificationService } from './notification.service';
import {
  ReminderNotificationDto,
  GroupReminderNotificationDto,
  ScheduleNotificationDto,
  GroupScheduleNotificationDto,
  CreateInternalNotificationDto,
} from './dto/notification.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

type UploadedAttachment = {
  originalname: string;
  buffer: Buffer;
  mimetype?: string;
};

@ApiTags('Notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  private mapAttachment(file?: UploadedAttachment) {
    if (!file) {
      return undefined;
    }

    if (!file.originalname?.trim() || !file.buffer?.length) {
      throw new BadRequestException('Attachment must include a filename and file content');
    }

    return {
      filename: file.originalname.trim(),
      content: file.buffer,
      type: file.mimetype || 'application/octet-stream',
    };
  }

  @Post('reminder')
  @UseInterceptors(FileInterceptor('attachment', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contact_ids: {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string', example: '["contact-uuid-1","contact-uuid-2"]' },
          ],
        },
        message: { type: 'string', nullable: true },
        attachment: { type: 'string', format: 'binary' },
      },
      required: ['contact_ids'],
    },
  })
  async sendReminder(
    @Body() dto: ReminderNotificationDto,
    @Request() req,
    @UploadedFile() attachment?: UploadedAttachment,
  ) {
    const message = dto.message || 'Please complete your payment as soon as possible.';
    const recipients = await Promise.all(
      dto.contact_ids.map(contactId =>
        this.notificationService.getContactEmail(req.user.organization_id, contactId),
      ),
    );

    const filtered = recipients.filter((email): email is string => !!email);
    return this.notificationService.sendReminder(filtered, message, this.mapAttachment(attachment));
  }

  @Post('reminder/groups')
  @UseInterceptors(FileInterceptor('attachment', {
    limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        group_ids: {
          oneOf: [
            { type: 'array', items: { type: 'string' } },
            { type: 'string', example: '["group-uuid-1","group-uuid-2"]' },
          ],
        },
        message: { type: 'string', nullable: true },
        attachment: { type: 'string', format: 'binary' },
      },
      required: ['group_ids'],
    },
  })
  async sendGroupReminder(
    @Body() dto: GroupReminderNotificationDto,
    @Request() req,
    @UploadedFile() attachment?: UploadedAttachment,
  ) {
    const message = dto.message || 'Please complete your payment as soon as possible.';
    const recipients = await this.notificationService.getGroupContactEmails(
      req.user.organization_id,
      dto.group_ids,
    );

    return this.notificationService.sendReminder(recipients, message, this.mapAttachment(attachment));
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
