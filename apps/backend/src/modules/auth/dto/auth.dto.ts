import { IsEmail, IsString, MinLength, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(3)
  organization_name: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ example: 'Mr' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Finance Director' })
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  password: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsString()
  refresh_token: string;
}

export class InviteUserDto {
  @ApiProperty({ example: 'staff@acme.com' })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({ enum: ['ADMIN', 'STAFF'], example: 'STAFF' })
  @IsOptional()
  @IsIn(['ADMIN', 'STAFF'])
  role?: 'ADMIN' | 'STAFF';

  @ApiPropertyOptional({ example: 'Mrs' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Accounts Officer' })
  @IsOptional()
  @IsString()
  designation?: string;
}

export class AcceptInviteDto {
  @ApiProperty({ example: 'invitation-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: 'Dr' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Assistant Bursar' })
  @IsOptional()
  @IsString()
  designation?: string;
}

export class PasswordResetRequestDto {
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;
}

export class PasswordResetConfirmDto {
  @ApiProperty({ example: 'reset-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NewStrongPass123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export class VerifyOrganizationEmailDto {
  @ApiProperty({ example: 'verification-token' })
  @IsString()
  token: string;
}
