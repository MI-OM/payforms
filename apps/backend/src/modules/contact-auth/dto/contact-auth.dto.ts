import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContactLoginDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'org-123' })
  @IsOptional()
  @IsString()
  organization_id?: string;

  @ApiPropertyOptional({ example: 'school' })
  @IsOptional()
  @IsString()
  organization_subdomain?: string;

  @ApiPropertyOptional({ example: 'pay.myuni.com' })
  @IsOptional()
  @IsString()
  organization_domain?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class ContactSetPasswordDto {
  @ApiProperty({ example: 'reset-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class ContactPasswordResetRequestDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'org-123' })
  @IsOptional()
  @IsString()
  organization_id?: string;

  @ApiPropertyOptional({ example: 'school' })
  @IsOptional()
  @IsString()
  organization_subdomain?: string;

  @ApiPropertyOptional({ example: 'pay.myuni.com' })
  @IsOptional()
  @IsString()
  organization_domain?: string;
}

export class ContactResetPasswordDto {
  @ApiProperty({ example: 'reset-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}
