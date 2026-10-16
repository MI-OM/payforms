import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PlatformLoginDto {
  @ApiProperty({ example: 'admin@payforms.com.ng' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(1)
  password: string;
}

export class PlatformRefreshTokenDto {
  @ApiPropertyOptional({ description: 'Optional when the refresh cookie is present' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}
