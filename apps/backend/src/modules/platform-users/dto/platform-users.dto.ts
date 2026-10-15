import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const PLATFORM_USER_ROLES = ['ADMIN', 'STAFF'] as const;
export type PlatformUserRole = (typeof PLATFORM_USER_ROLES)[number];

export const PLATFORM_USER_STATUSES = ['active', 'inactive'] as const;
export type PlatformUserStatus = (typeof PLATFORM_USER_STATUSES)[number];

export class ListPlatformUsersQueryDto {
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

  @ApiPropertyOptional({
    example: 'jane',
    description: 'Matches email, first or last name, or id',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ example: 'jane@example.com', description: 'Partial email match' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  email?: string;

  @ApiPropertyOptional({ description: 'Restrict results to a single organization' })
  @IsOptional()
  @IsUUID()
  organization_id?: string;

  @ApiPropertyOptional({ enum: PLATFORM_USER_ROLES })
  @IsOptional()
  @IsIn(PLATFORM_USER_ROLES)
  role?: PlatformUserRole;

  @ApiPropertyOptional({
    enum: PLATFORM_USER_STATUSES,
    description: 'Whether the user account is active or disabled',
  })
  @IsOptional()
  @IsIn(PLATFORM_USER_STATUSES)
  status?: PlatformUserStatus;
}

export class ChangeUserStatusDto {
  @ApiProperty({
    example: false,
    description: 'false disables the user (revokes sessions); true re-enables them',
  })
  @IsBoolean()
  is_active: boolean;

  @ApiPropertyOptional({
    example: 'Compromised credentials reported by the customer',
    description: 'Required when disabling a user',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class ResetUserTwoFactorDto {
  @ApiPropertyOptional({
    example: 'User lost their authenticator device during support call',
    description: 'Required to record why 2FA was reset',
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}
