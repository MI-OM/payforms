import { Transform } from 'class-transformer';
import { IsString, IsArray, IsEmail, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item));
  }

  if (typeof value !== 'string') {
    return [];
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.map(item => String(item));
    }
  } catch {
    // Fall back to comma-separated input.
  }

  return trimmed
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

export class ReminderNotificationDto {
  @ApiProperty({ type: [String], example: ['contact-uuid-1', 'contact-uuid-2'] })
  @Transform(({ value }) => parseStringArray(value))
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
  @Transform(({ value }) => parseStringArray(value))
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
  @Transform(({ value }) => parseStringArray(value))
  @IsArray()
  @IsString({ each: true })
  group_ids: string[];
}

export class CreateInternalNotificationDto {
  @ApiProperty({ example: 'Billing alert' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'Monthly email threshold is close to limit.' })
  @IsString()
  body: string;

  @ApiPropertyOptional({ type: [String], example: ['user-uuid-1', 'user-uuid-2'] })
  @IsOptional()
  @Transform(({ value }) => parseStringArray(value))
  @IsArray()
  @IsString({ each: true })
  user_ids?: string[];
}
