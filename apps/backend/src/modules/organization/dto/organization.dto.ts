import { IsString, IsEmail, IsOptional, IsBoolean, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}

export class UploadLogoDto {
  @ApiProperty({ example: 'https://example.com/logo.png', description: 'Logo URL. File size must not exceed 2 MB.' })
  @IsString()
  logo_url: string;
}
