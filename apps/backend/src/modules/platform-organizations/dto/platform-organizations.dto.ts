import { Type } from 'class-transformer';
import {
  IsIn,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ORGANIZATION_STATUSES,
  OrganizationStatus,
} from '../../organization/organization-status.constants';

export class ListPlatformOrganizationsQueryDto {
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

  @ApiPropertyOptional({ example: 'greenfield', description: 'Matches name, email, subdomain, custom domain or id' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: ORGANIZATION_STATUSES })
  @IsOptional()
  @IsIn(ORGANIZATION_STATUSES)
  status?: OrganizationStatus;

  @ApiPropertyOptional({ example: 'professional', description: 'Billing plan tier' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  plan?: string;
}

export class ChangeOrganizationStatusDto {
  @ApiProperty({ enum: ORGANIZATION_STATUSES })
  @IsIn(ORGANIZATION_STATUSES)
  status: OrganizationStatus;

  @ApiPropertyOptional({ example: 'Non-payment of subscription invoice', description: 'Required when suspending or disabling' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;

  @ApiPropertyOptional({
    example: '2026-11-01T00:00:00.000Z',
    description: 'Optional auto-expiry. Only valid when status is "suspended".',
  })
  @IsOptional()
  @IsISO8601()
  expires_at?: string;
}

export class ListOrganizationStatusEventsQueryDto {
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
}
