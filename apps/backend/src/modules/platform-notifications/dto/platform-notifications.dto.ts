import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ORGANIZATION_STATUSES,
  OrganizationStatus,
} from '../../organization/organization-status.constants';
import {
  PlatformNotificationAudienceType,
  PlatformNotificationStatus,
} from '../entities/platform-notification.entity';
import { PlatformNotificationDeliveryStatus } from '../entities/platform-notification-delivery.entity';

export const PLATFORM_NOTIFICATION_STATUSES: PlatformNotificationStatus[] = [
  'queued',
  'sent',
  'partial',
  'failed',
  'dry_run',
];

export const PLATFORM_NOTIFICATION_DELIVERY_STATUSES: PlatformNotificationDeliveryStatus[] =
  ['sent', 'failed', 'skipped'];

export const PLATFORM_NOTIFICATION_AUDIENCE_TYPES: PlatformNotificationAudienceType[] =
  ['ALL', 'SEGMENT'];

/** Optional narrow-down used when `audience_type` is `SEGMENT`. */
export class PlatformNotificationSegmentDto {
  @ApiPropertyOptional({ example: 'professional', description: 'Billing plan tier' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  plan?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES)
  status?: OrganizationStatus;
}

export class ComposePlatformNotificationDto {
  @ApiProperty({ example: 'Scheduled maintenance on Saturday' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: '<p>Payforms will be briefly unavailable...</p>', description: 'HTML body' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body: string;

  @ApiProperty({ enum: PLATFORM_NOTIFICATION_AUDIENCE_TYPES, example: 'ALL' })
  @IsIn(PLATFORM_NOTIFICATION_AUDIENCE_TYPES)
  audience_type: PlatformNotificationAudienceType;

  @ApiPropertyOptional({ type: PlatformNotificationSegmentDto, description: 'Required when audience_type is SEGMENT' })
  @IsOptional()
  @ValidateNested()
  @Type(() => PlatformNotificationSegmentDto)
  segment?: PlatformNotificationSegmentDto;

  @ApiPropertyOptional({
    example: false,
    description: 'When true, resolve recipients and record deliveries without sending any email.',
  })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}

export class NotifyOrganizationDto {
  @ApiProperty({ example: 'Your subscription payment failed' })
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  subject: string;

  @ApiProperty({ example: '<p>Please update your card to avoid suspension.</p>', description: 'HTML body' })
  @IsString()
  @MinLength(1)
  @MaxLength(20000)
  body: string;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  dry_run?: boolean;
}

export class ListPlatformNotificationsQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: PLATFORM_NOTIFICATION_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_NOTIFICATION_STATUSES)
  status?: PlatformNotificationStatus;

  @ApiPropertyOptional({ enum: PLATFORM_NOTIFICATION_AUDIENCE_TYPES })
  @IsOptional()
  @IsIn(PLATFORM_NOTIFICATION_AUDIENCE_TYPES)
  audience_type?: PlatformNotificationAudienceType;

  @ApiPropertyOptional({ example: 'maintenance', description: 'Case-insensitive subject search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}

export class ListPlatformNotificationDeliveriesQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 50, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ enum: PLATFORM_NOTIFICATION_DELIVERY_STATUSES })
  @IsOptional()
  @IsIn(PLATFORM_NOTIFICATION_DELIVERY_STATUSES)
  status?: PlatformNotificationDeliveryStatus;
}
