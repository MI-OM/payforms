import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber, IsArray, ArrayUnique, IsEnum } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PAYMENT_METHODS, PaymentMethod } from '../../payment/entities/payment.entity';

export class CreateOrganizationDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'support@acme.com' })
  @IsEmail()
  email: string;
}

export class UpdateOrganizationDto {
  @ApiPropertyOptional({ example: 'Acme Corp' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'support@acme.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'school' })
  @IsOptional()
  @IsString()
  subdomain?: string;

  @ApiPropertyOptional({ example: 'pay.myuni.com' })
  @IsOptional()
  @IsString()
  custom_domain?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  require_contact_login?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notify_submission_confirmation?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notify_payment_confirmation?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  notify_payment_failure?: boolean;

  @ApiPropertyOptional({ example: 500.00, description: 'Minimum allowed partial payment amount' })
  @IsOptional()
  @IsNumber()
  partial_payment_limit?: number;

  @ApiPropertyOptional({ enum: PAYMENT_METHODS, isArray: true, example: ['ONLINE', 'CASH'] })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === undefined || value === null) {
      return undefined;
    }

    const values = Array.isArray(value) ? value : [value];
    return values
      .map(item => (typeof item === 'string' ? item.trim().toUpperCase() : item))
      .filter(Boolean);
  })
  @IsArray()
  @ArrayUnique()
  @IsEnum(PAYMENT_METHODS, { each: true })
  enabled_payment_methods?: PaymentMethod[];
}

export class UpdateOrganizationKeysDto {
  @ApiPropertyOptional({ example: 'pk_test_xxx' })
  @IsOptional()
  @IsString()
  paystack_public_key?: string;

  @ApiPropertyOptional({ example: 'sk_test_xxx' })
  @IsOptional()
  @IsString()
  paystack_secret_key?: string;

  @ApiPropertyOptional({ example: 'https://api.payforms.com.ng/webhooks/paystack' })
  @IsOptional()
  @IsString()
  paystack_webhook_url?: string;
}

export class UploadLogoDto {
  @ApiProperty({ example: 'https://example.com/logo.png', description: 'Logo URL. File size must not exceed 2 MB.' })
  @IsString()
  logo_url: string;
}
