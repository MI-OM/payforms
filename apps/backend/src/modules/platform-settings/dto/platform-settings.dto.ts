import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PLATFORM_SETTING_CATEGORIES,
  PlatformSettingCategory,
  PLATFORM_SETTING_VALUE_TYPES,
  PlatformSettingValueType,
} from '../platform-settings.constants';

export class ListPlatformSettingsQueryDto {
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

  @ApiPropertyOptional({ enum: PLATFORM_SETTING_CATEGORIES })
  @IsOptional()
  @IsIn(PLATFORM_SETTING_CATEGORIES)
  category?: PlatformSettingCategory;

  @ApiPropertyOptional({ example: 'support', description: 'Case-insensitive key/description search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class SetPlatformSettingDto {
  @ApiProperty({
    description: 'Any JSON value; must match value_type.',
    example: 'support@payforms.com.ng',
  })
  @IsDefined()
  value: any;

  @ApiProperty({ enum: PLATFORM_SETTING_VALUE_TYPES, example: 'string' })
  @IsIn(PLATFORM_SETTING_VALUE_TYPES)
  value_type: PlatformSettingValueType;

  @ApiPropertyOptional({ enum: PLATFORM_SETTING_CATEGORIES, example: 'GENERAL' })
  @IsOptional()
  @IsIn(PLATFORM_SETTING_CATEGORIES)
  category?: PlatformSettingCategory;

  @ApiPropertyOptional({ example: 'Address shown in the platform footer' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    example: false,
    description: 'Secret values are stored but never returned by the API.',
  })
  @IsOptional()
  @IsBoolean()
  is_secret?: boolean;
}

export class ListFeatureFlagsQueryDto {
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ example: 'impersonation', description: 'Case-insensitive key/description search' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class UpsertFeatureFlagDto {
  @ApiPropertyOptional({ example: 'Allow platform operators to impersonate tenant admins' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ example: false, description: 'Global default applied when no org override exists' })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class SetFeatureFlagOverrideDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiPropertyOptional({ example: 'Enterprise contract includes early access' })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason?: string;
}

export class ResolveFeatureFlagQueryDto {
  @ApiPropertyOptional({ example: 'org-uuid' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  organization_id?: string;
}
