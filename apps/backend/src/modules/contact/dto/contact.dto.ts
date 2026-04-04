import { IsString, IsEmail, IsOptional, IsBoolean, IsArray, ValidateNested, IsIn, IsNumber, IsUUID } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const toStringArray = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (Array.isArray(value)) {
    return value
      .map(item => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  return undefined;
};

const toOptionalBoolean = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1 ? true : value === 0 ? false : value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }

  return value;
};

export class CreateContactDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Michael' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'STU-2024-001' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ example: 'crm-12345' })
  @IsOptional()
  @IsString()
  external_id?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  guardian_name?: string;

  @ApiPropertyOptional({ example: 'jane.guardian@example.com' })
  @IsOptional()
  @IsEmail()
  guardian_email?: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @IsOptional()
  @IsString()
  guardian_phone?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'If true, contact is flagged for password setup/login flow. Defaults to true when omitted.',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  require_login?: boolean;

  @ApiPropertyOptional({
    example: true,
    description: 'Override reset/setup requirement directly. Defaults to require_login value.',
  })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  must_reset_password?: boolean;
}

export class UpdateContactDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Michael' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'M' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'STU-2024-001' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ example: 'crm-12345' })
  @IsOptional()
  @IsString()
  external_id?: string;

  @ApiPropertyOptional({ example: 'Jane Doe' })
  @IsOptional()
  @IsString()
  guardian_name?: string;

  @ApiPropertyOptional({ example: 'jane.guardian@example.com' })
  @IsOptional()
  @IsEmail()
  guardian_email?: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @IsOptional()
  @IsString()
  guardian_phone?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}

export class BulkImportContactsDto {
  @ApiProperty({ type: () => [ContactImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactImportRowDto)
  contacts: ContactImportRowDto[];
}

export class ContactImportRowDto {
  @ApiPropertyOptional({ example: 'John' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'Michael' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiProperty({ example: 'jane@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: '+2348098765432' })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({ example: 'F' })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ example: 'STU-2024-123' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ example: 'external-456' })
  @IsOptional()
  @IsString()
  external_id?: string;

  @ApiPropertyOptional({ example: 'John Guardian' })
  @IsOptional()
  @IsString()
  guardian_name?: string;

  @ApiPropertyOptional({ example: 'guardian@example.com' })
  @IsOptional()
  @IsEmail()
  guardian_email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  guardian_phone?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['a7d25fe8-0285-4f78-b58f-4f2be91eaadf'],
    description: 'Existing group IDs to assign to the contact',
  })
  @Transform(toStringArray)
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  group_ids?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Returning Students', 'Priority'],
    description: 'Group names; missing groups are auto-created as root groups',
  })
  @Transform(toStringArray)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groups?: string[];

  @ApiPropertyOptional({
    type: [String],
    example: ['Faculty > Engineering > 400 Level'],
    description: "Nested group paths using '>' separator; missing hierarchy is auto-created",
  })
  @Transform(toStringArray)
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  group_paths?: string[];

  @ApiPropertyOptional({ example: true, description: 'If true, contact will be flagged for password setup/login flow' })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  require_login?: boolean;

  @ApiPropertyOptional({ example: true })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  is_active?: boolean;

  @ApiPropertyOptional({ example: true, description: 'Override must_reset_password directly when needed' })
  @Transform(toOptionalBoolean)
  @IsOptional()
  @IsBoolean()
  must_reset_password?: boolean;
}

export class ContactImportValidateDto {
  @ApiProperty({ type: () => [ContactImportRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactImportRowDto)
  contacts: ContactImportRowDto[];
}

export class ContactImportCommitDto {
  @ApiProperty({ example: 'e4f9d7e1-8d81-4d1f-b939-19a995a8bb36' })
  @IsString()
  import_id: string;
}

export class ContactCsvImportDto {
  @ApiProperty({
    example: 'name,email,phone,external_id,groups,group_paths,require_login,is_active,must_reset_password\nJane Doe,jane@example.com,+2348012345678,student-123,"Returning Students; Priority","Faculty > Engineering",true,true,false',
    description: 'CSV payload with headers matching contact import fields. Boolean fields accept true/false, 1/0, yes/no.',
  })
  @IsString()
  csv: string;
}

export class ContactQueryDto {
  @ApiPropertyOptional({ example: 'group-uuid' })
  @IsOptional()
  @IsString()
  group_id?: string;

  @ApiPropertyOptional({ example: 'STU-2024-001' })
  @IsOptional()
  @IsString()
  student_id?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: 'Jane' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'john@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'external-123' })
  @IsOptional()
  @IsString()
  external_id?: string;

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

export class ContactTransactionQueryDto {
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

export class AssignContactGroupsDto {
  @ApiProperty({ type: [String], example: ['group-uuid-1', 'group-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  group_ids: string[];
}
