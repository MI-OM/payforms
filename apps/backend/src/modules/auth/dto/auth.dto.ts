import { IsEmail, IsString, MinLength, IsOptional, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const PASSWORD_STRENGTH_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{12,}$/;
const PASSWORD_STRENGTH_MESSAGE =
  'Password must be at least 12 characters long and include uppercase, lowercase, number, and special character.';

export class RegisterDto {
  @ApiProperty({ example: 'Acme Corp' })
  @IsString()
  @MinLength(3)
  organization_name: string;

  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(12)
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  password: string;
}

export class LoginDto {
  @ApiProperty({ example: 'admin@acme.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: 'org-uuid' })
  @IsOptional()
  @IsString()
  organization_id?: string;

  @ApiPropertyOptional({ example: 'acme-school' })
  @IsOptional()
  @IsString()
  organization_subdomain?: string;

  @ApiPropertyOptional({ example: 'pay.acme.com' })
  @IsOptional()
  @IsString()
  organization_domain?: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  @IsOptional()
  @IsString()
  refresh_token?: string;
}

export class InviteUserDto {
  @ApiProperty({ example: 'Janet' })
  @IsString()
  @MinLength(1)
  first_name: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(1)
  last_name: string;

  @ApiProperty({ example: 'staff@acme.com' })
  @IsEmail()
  email: string;
}

export class AcceptInviteDto {
  @ApiProperty({ example: 'invitation-token' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'StrongPass123!' })
  @IsString()
  @MinLength(12)
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  password: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Janet' })
  @IsOptional()
  @IsString()
  first_name?: string;

  @ApiPropertyOptional({ example: 'M.' })
  @IsOptional()
  @IsString()
  middle_name?: string;

  @ApiPropertyOptional({ example: 'Doe' })
  @IsOptional()
  @IsString()
  last_name?: string;

  @ApiPropertyOptional({ example: 'Mrs' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Accounts Officer' })
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
  @MinLength(12)
  @Matches(PASSWORD_STRENGTH_REGEX, { message: PASSWORD_STRENGTH_MESSAGE })
  password: string;
}

export class VerifyOrganizationEmailDto {
  @ApiProperty({ example: 'verification-token' })
  @IsString()
  token: string;
}

export class EnableTwoFactorDto {
  @ApiProperty({ example: '123456' })
  @IsString()
  code: string;
}

export class VerifyTwoFactorLoginDto {
  @ApiProperty({ example: 'two-factor-challenge-token' })
  @IsString()
  challenge_token: string;

  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'ABCD-EFGH' })
  @IsOptional()
  @IsString()
  recovery_code?: string;
}

export class TwoFactorRecoveryActionDto {
  @ApiPropertyOptional({ example: '123456' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional({ example: 'ABCD-EFGH' })
  @IsOptional()
  @IsString()
  recovery_code?: string;
}
