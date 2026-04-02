import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, RefreshTokenDto, InviteUserDto, AcceptInviteDto, PasswordResetRequestDto, PasswordResetConfirmDto, VerifyOrganizationEmailDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Post('invite')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async inviteUser(@Request() req, @Body() dto: InviteUserDto) {
    return this.authService.inviteUser(req.user, dto);
  }

  @Post('accept-invite')
  async acceptInvite(@Body() dto: AcceptInviteDto) {
    return this.authService.acceptInvite(dto);
  }

  @Post('refresh')
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refreshTokens(dto);
  }

  @Post('password-reset/request')
  async requestPasswordReset(@Body() dto: PasswordResetRequestDto) {
    return this.authService.requestPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  async confirmPasswordReset(@Body() dto: PasswordResetConfirmDto) {
    return this.authService.confirmPasswordReset(dto);
  }

  @Post('organization-email/verify')
  async verifyOrganizationEmail(@Body() dto: VerifyOrganizationEmailDto) {
    return this.authService.verifyOrganizationEmail(dto);
  }

  @Post('organization-email/request-verification')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async requestOrganizationEmailVerification(@Request() req) {
    return this.authService.requestOrganizationEmailVerification(req.user);
  }

  @Get('organization-email/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getOrganizationEmailVerificationStatus(@Request() req) {
    return this.authService.getOrganizationEmailVerificationStatus(req.user);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Request() req) {
    return this.authService.logout(req.user.id);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentUser(@Request() req) {
    return req.user;
  }
}
