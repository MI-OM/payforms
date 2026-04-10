import { Transform, Type } from 'class-transformer';
import { IsString, IsOptional, IsObject, IsEmail, IsNumber, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAYMENT_METHODS, PaymentMethod } from '../../payment/entities/payment.entity';

export class CreateSubmissionDto {
  @ApiProperty({ type: 'object', additionalProperties: true, example: { student_name: 'John Doe' } })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @IsString()
  contact_id?: string;
}

export class PublicSubmitFormDto {
  @ApiProperty({ type: 'object', additionalProperties: true, example: { student_name: 'John Doe' } })
  @IsObject()
  data: Record<string, any>;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  contact_email?: string;

  @ApiPropertyOptional({ example: 'John Doe' })
  @IsOptional()
  @IsString()
  contact_name?: string;

  @ApiPropertyOptional({ example: 50000, description: 'Amount to pay now for partial payments' })
  @IsOptional()
  @IsNumber()
  partial_amount?: number;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, example: 'ONLINE' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsIn(PAYMENT_METHODS)
  payment_method?: PaymentMethod;
}

export class SubmissionExportQueryDto {
  @ApiPropertyOptional({ example: 'form-uuid' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  form_id?: string;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  contact_id?: string;

  @ApiPropertyOptional({ example: '2026-04-01' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-04-30' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  end_date?: string;

  @ApiPropertyOptional({ enum: ['csv', 'pdf'], example: 'csv' })
  @IsOptional()
  @IsIn(['csv', 'pdf'])
  format?: 'csv' | 'pdf';

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
}
