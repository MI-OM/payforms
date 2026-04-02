import { IsString, IsOptional, IsObject, IsEmail } from 'class-validator';
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
}
