import { IsString, IsNumber, IsOptional, IsEnum, IsIn } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAYMENT_METHODS, PaymentMethod } from '../entities/payment.entity';

export class CreatePaymentDto {
  @ApiProperty({ example: 'submission-uuid' })
  @IsString()
  submission_id: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 100000, description: 'Total amount owed (for partial payments)' })
  @IsOptional()
  @IsNumber()
  total_amount?: number;

  @ApiPropertyOptional({ example: 'PAY_2026_0001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, example: 'ONLINE' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsEnum(PAYMENT_METHODS)
  payment_method?: PaymentMethod;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'PAY_2026_0001' })
  @IsString()
  reference: string;
}

export class TransactionQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED'], example: 'PAID' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsEnum(['PENDING', 'PAID', 'PARTIAL', 'FAILED'])
  status?: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';

  @ApiPropertyOptional({ example: 'PAY_2026_0001' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional({ example: 'form-uuid' })
  @IsOptional()
  @IsString()
  form_id?: string;

  @ApiPropertyOptional({ example: 'contact-uuid' })
  @IsOptional()
  @IsString()
  contact_id?: string;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, example: 'CASH' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsEnum(PAYMENT_METHODS)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({ example: '2026-01-01' })
  @IsOptional()
  @IsString()
  start_date?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsString()
  end_date?: string;

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

  @ApiPropertyOptional({ enum: ['csv'], example: 'csv' })
  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';
}

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED'], example: 'PAID' })
  @IsEnum(['PENDING', 'PAID', 'PARTIAL', 'FAILED'])
  status: 'PENDING' | 'PAID' | 'PARTIAL' | 'FAILED';

  @ApiPropertyOptional({ example: '2026-04-02T02:00:00.000Z' })
  @IsOptional()
  paid_at?: Date;

  @ApiPropertyOptional({ example: 1500, description: 'Used for partial payment tracking' })
  @IsOptional()
  @IsNumber()
  amount_paid?: number;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, example: 'CASH' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().toUpperCase() : value)
  @IsEnum(PAYMENT_METHODS)
  payment_method?: PaymentMethod;

  @ApiPropertyOptional({ example: 'Confirmed against teller 447120 on 2026-04-10.' })
  @IsOptional()
  @IsString()
  confirmation_note?: string;

  @ApiPropertyOptional({ example: 'TELLER-447120' })
  @IsOptional()
  @IsString()
  external_reference?: string;
}

export class PaystackWebhookDto {
  @ApiProperty({ example: 'charge.success' })
  event: string;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: {
      id: 123456789,
      reference: 'PAY_2026_0001',
      amount: 2500000,
      paid_at: '2026-04-02T02:00:00.000Z',
      status: 'success',
      customer: {
        email: 'john@example.com',
        customer_code: 'CUS_xxx',
      },
    },
  })
  data: {
    id: number;
    reference: string;
    amount: number;
    paid_at: string;
    status: string;
    customer: {
      email: string;
      customer_code: string;
    };
  };
}
