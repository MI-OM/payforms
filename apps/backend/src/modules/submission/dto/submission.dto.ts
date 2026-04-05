import { IsString, IsOptional, IsObject, IsEmail, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
}
