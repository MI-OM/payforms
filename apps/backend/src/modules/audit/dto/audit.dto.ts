import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ActivityLogQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ example: 'VIEW TRANSACTIONS' })
  @IsOptional()
  @IsString()
  action?: string;

  @ApiPropertyOptional({ example: 'Contact' })
  @IsOptional()
  @IsString()
  entity_type?: string;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @IsString()
  entity_id?: string;

  @ApiPropertyOptional({ example: 'user-uuid' })
  @IsOptional()
  @IsString()
  user_id?: string;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @IsString()
  contact_id?: string;

  @ApiPropertyOptional({ example: '105.112.73.43' })
  @IsOptional()
  @IsString()
  ip_address?: string;

  @ApiPropertyOptional({ example: 'Mozilla/5.0' })
  @IsOptional()
  @IsString()
  user_agent?: string;

  @ApiPropertyOptional({ example: 'transaction' })
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

export class PaymentLogQueryDto {
  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;

  @ApiPropertyOptional({ example: 'payment.status.updated' })
  @IsOptional()
  @IsString()
  event?: string;

  @ApiPropertyOptional({ example: 'evt_123' })
  @IsOptional()
  @IsString()
  event_id?: string;

  @ApiPropertyOptional({ example: 'paystack' })
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
