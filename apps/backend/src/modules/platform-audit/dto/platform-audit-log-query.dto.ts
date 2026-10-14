import { Type } from 'class-transformer';
import { IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformAuditLogQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({ example: 'platform-user-uuid' })
  @IsOptional()
  @IsString()
  actor_id?: string;

  @ApiPropertyOptional({ example: 'admin@payforms.com.ng' })
  @IsOptional()
  @IsString()
  actor_email?: string;

  @ApiPropertyOptional({ example: 'PLATFORM ADMIN LOGIN' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'Organization' })
  @IsOptional()
  @IsString()
  resource_type?: string;

  @ApiPropertyOptional({ example: 'organization-uuid' })
  @IsOptional()
  @IsString()
  resource_id?: string;

  @ApiPropertyOptional({ example: 'POST' })
  @IsOptional()
  @IsString()
  method?: string;

  @ApiPropertyOptional({ example: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  status_code?: number;

  @ApiPropertyOptional({ example: '105.112.73.43' })
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: 'organization disabled' })
  @IsOptional()
  @IsString()
  keyword?: string;

  @ApiPropertyOptional({ example: '2026-04-15T00:00:00.000Z' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-04-15T23:59:59.999Z' })
  @IsOptional()
  @IsString()
  to?: string;
}
