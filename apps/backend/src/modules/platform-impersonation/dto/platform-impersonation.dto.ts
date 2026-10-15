import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IMPERSONATION_MAX_DURATION_MINUTES,
  IMPERSONATION_MIN_DURATION_MINUTES,
  IMPERSONATION_REASON_MAX_LENGTH,
  IMPERSONATION_REASON_MIN_LENGTH,
  IMPERSONATION_STATUSES,
  ImpersonationStatus,
} from '../platform-impersonation.constants';

export class StartImpersonationDto {
  @ApiPropertyOptional({
    description:
      'Tenant user to impersonate. When omitted, the organization\'s primary active ADMIN is used.',
  })
  @IsOptional()
  @IsUUID()
  user_id?: string;

  @ApiProperty({
    example: 'Investigating a reported payment failure (ticket #4821)',
    description: 'Mandatory justification, recorded on the session and in the audit trail.',
  })
  @IsString()
  @MinLength(IMPERSONATION_REASON_MIN_LENGTH)
  @MaxLength(IMPERSONATION_REASON_MAX_LENGTH)
  reason: string;

  @ApiPropertyOptional({
    example: 30,
    minimum: IMPERSONATION_MIN_DURATION_MINUTES,
    maximum: IMPERSONATION_MAX_DURATION_MINUTES,
    description: 'Session length in minutes.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(IMPERSONATION_MIN_DURATION_MINUTES)
  @Max(IMPERSONATION_MAX_DURATION_MINUTES)
  duration_minutes?: number;
}

export class ListImpersonationSessionsQueryDto {
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

  @ApiPropertyOptional({ enum: IMPERSONATION_STATUSES })
  @IsOptional()
  @IsIn(IMPERSONATION_STATUSES)
  status?: ImpersonationStatus;

  @ApiPropertyOptional({ description: 'Filter by organization id' })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({ description: 'Filter by platform operator id' })
  @IsOptional()
  @IsUUID()
  platform_user_id?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-31T23:59:59.999Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;
}
