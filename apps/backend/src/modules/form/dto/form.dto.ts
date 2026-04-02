import { IsString, IsOptional, IsNumber, IsBoolean, IsArray, ValidateNested, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FORM_ACCESS_MODES = ['OPEN', 'LOGIN_REQUIRED', 'TARGETED_ONLY'] as const;
export type FormAccessMode = (typeof FORM_ACCESS_MODES)[number];

export const FORM_IDENTITY_VALIDATION_MODES = ['NONE', 'CONTACT_EMAIL', 'CONTACT_EXTERNAL_ID'] as const;
export type FormIdentityValidationMode = (typeof FORM_IDENTITY_VALIDATION_MODES)[number];

export class CreateFormDto {
  @ApiProperty({ example: 'School Fees Payment' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Education' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Annual tuition payment form for 2026 session' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Only use this form for approved applicants' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ example: 'school-fees-2026' })
  @IsString()
  slug: string;

  @ApiProperty({ enum: ['FIXED', 'VARIABLE'], example: 'FIXED' })
  @IsString()
  payment_type: 'FIXED' | 'VARIABLE';

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiProperty({ example: false })
  @IsBoolean()
  allow_partial: boolean;

  @ApiPropertyOptional({ enum: FORM_ACCESS_MODES, example: 'OPEN' })
  @IsOptional()
  @IsIn(FORM_ACCESS_MODES)
  access_mode?: FormAccessMode;

  @ApiPropertyOptional({ enum: FORM_IDENTITY_VALIDATION_MODES, example: 'NONE' })
  @IsOptional()
  @IsIn(FORM_IDENTITY_VALIDATION_MODES)
  identity_validation_mode?: FormIdentityValidationMode;

  @ApiPropertyOptional({
    example: 'Student ID Number',
    description: 'Required when identity_validation_mode is CONTACT_EXTERNAL_ID.',
  })
  @IsOptional()
  @IsString()
  identity_field_label?: string;
}

export class UpdateFormDto {
  @ApiPropertyOptional({ example: 'School Fees Payment' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Education' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: 'Annual tuition payment form for 2026 session' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Only use this form for approved applicants' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: 25000 })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  allow_partial?: boolean;

  @ApiPropertyOptional({ enum: FORM_ACCESS_MODES, example: 'LOGIN_REQUIRED' })
  @IsOptional()
  @IsIn(FORM_ACCESS_MODES)
  access_mode?: FormAccessMode;

  @ApiPropertyOptional({ enum: FORM_IDENTITY_VALIDATION_MODES, example: 'CONTACT_EXTERNAL_ID' })
  @IsOptional()
  @IsIn(FORM_IDENTITY_VALIDATION_MODES)
  identity_validation_mode?: FormIdentityValidationMode;

  @ApiPropertyOptional({
    example: 'Student ID Number',
    description: 'Required when identity_validation_mode is CONTACT_EXTERNAL_ID.',
  })
  @IsOptional()
  @IsString()
  identity_field_label?: string;
}

export class CreateFormFieldDto {
  @ApiProperty({ example: 'Student Full Name' })
  @IsString()
  label: string;

  @ApiProperty({ enum: ['TEXT', 'EMAIL', 'SELECT', 'NUMBER', 'TEXTAREA'], example: 'TEXT' })
  @IsString()
  type: 'TEXT' | 'EMAIL' | 'SELECT' | 'NUMBER' | 'TEXTAREA';

  @ApiProperty({ example: true })
  @IsBoolean()
  required: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Option A', 'Option B'] })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsNumber()
  order_index?: number;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, example: { min: 3 } })
  @IsOptional()
  validation_rules?: Record<string, any>;
}

export class UpdateFormFieldDto {
  @ApiPropertyOptional({ example: 'Student Full Name' })
  @IsOptional()
  @IsString()
  label?: string;

  @ApiPropertyOptional({ enum: ['TEXT', 'EMAIL', 'SELECT', 'NUMBER', 'TEXTAREA'], example: 'TEXT' })
  @IsOptional()
  @IsString()
  type?: 'TEXT' | 'EMAIL' | 'SELECT' | 'NUMBER' | 'TEXTAREA';

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Option A', 'Option B'] })
  @IsOptional()
  @IsArray()
  options?: string[];

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, example: { min: 3 } })
  @IsOptional()
  validation_rules?: Record<string, any>;
}

export class ReorderFieldsDto {
  @ApiProperty({ type: () => [FieldOrder] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FieldOrder)
  fields: FieldOrder[];
}

export class FieldOrder {
  @ApiProperty({ example: 'field-uuid' })
  @IsString()
  id: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  order_index: number;
}

export class AssignFormTargetsDto {
  @ApiProperty({ enum: ['group', 'contact'], example: 'group' })
  @IsString()
  target_type: 'group' | 'contact';

  @ApiProperty({ type: [String], example: ['target-uuid-1', 'target-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  target_ids: string[];
}

export class AssignFormGroupsDto {
  @ApiProperty({ type: [String], example: ['group-uuid-1', 'group-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  group_ids: string[];
}
