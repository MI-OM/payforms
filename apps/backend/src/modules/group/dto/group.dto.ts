import { IsString, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateGroupDto {
  @ApiProperty({ example: 'Alumni 2026' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Graduating class contacts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Use this group for webinar reminders' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'parent-group-uuid' })
  @IsOptional()
  @IsString()
  parent_group_id?: string;
}

export class UpdateGroupDto {
  @ApiPropertyOptional({ example: 'Alumni 2026' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 'Graduating class contacts' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Use this group for webinar reminders' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ example: 'parent-group-uuid' })
  @IsOptional()
  @IsString()
  parent_group_id?: string;
}

export class AddContactsToGroupDto {
  @ApiProperty({ type: [String], example: ['contact-uuid-1', 'contact-uuid-2'] })
  @IsArray()
  @IsString({ each: true })
  contact_ids: string[];
}
