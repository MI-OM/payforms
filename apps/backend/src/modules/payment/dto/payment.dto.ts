import { IsString, IsNumber, IsOptional, IsEnum, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePaymentDto {
  @ApiProperty({ example: 'submission-uuid' })
  @IsString()
  submission_id: string;

  @ApiProperty({ example: 25000 })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({ example: 'PAY_2026_0001' })
  @IsOptional()
  @IsString()
  reference?: string;
}

export class VerifyPaymentDto {
  @ApiProperty({ example: 'PAY_2026_0001' })
  @IsString()
  reference: string;
}

export class TransactionQueryDto {
  @ApiPropertyOptional({ enum: ['PENDING', 'PAID', 'PARTIAL', 'FAILED'], example: 'PAID' })
  @IsOptional()
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
