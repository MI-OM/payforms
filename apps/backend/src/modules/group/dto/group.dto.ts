import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Alumni 2026' })
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Graduating class contacts' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Use this group for webinar reminders' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'parent-group-uuid' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsString()
  parent_group_id?: string;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Alumni 2026' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Graduating class contacts' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Use this group for webinar reminders' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'parent-group-uuid' })
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim() || undefined : value)
  @IsString()
  parent_group_id?: string;
}

export class AddContactsToGroupDto {
  @ApiProperty({ type: [String], example: ['contact-uuid-1', 'contact-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  contact_ids: string[];
}

export class RemoveContactsFromGroupDto {
  @ApiProperty({ type: [String], example: ['contact-uuid-1', 'contact-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  contact_ids: string[];
}
