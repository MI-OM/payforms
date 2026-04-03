import { IsString, IsArray, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReminderNotificationDto {
  @ApiProperty({ type: [String], example: ['contact-uuid-1', 'contact-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  contact_ids: string[];

  @ApiPropertyOptional({ example: 'Your payment is due tomorrow.' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class GroupReminderNotificationDto {
  @ApiProperty({ type: [String], example: ['group-uuid-1', 'group-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  group_ids: string[];

  @ApiPropertyOptional({ example: 'Your payment is due tomorrow.' })
  @IsOptional()
  @IsString()
  message?: string;
}

export class ScheduleNotificationDto {
  @ApiProperty({ example: 'Payment Reminder' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Please complete your payment today.' })
  @IsString()
  body: string;

  @ApiProperty({ type: [String], example: ['john@example.com', 'jane@example.com'] })
  @IsArray()
  @IsEmail(undefined, { each: true })
  recipients: string[];
}

export class GroupScheduleNotificationDto {
  @ApiProperty({ example: 'Payment Reminder' })
  @IsString()
  subject: string;

  @ApiProperty({ example: 'Please complete your payment today.' })
  @IsString()
  body: string;

  @ApiProperty({ type: [String], example: ['group-uuid-1', 'group-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  group_ids: string[];
}
