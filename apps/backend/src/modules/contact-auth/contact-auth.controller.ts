import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactAuthService } from './contact-auth.service';
import {
  ContactLoginDto,
  ContactSetPasswordDto,
  ContactPasswordResetRequestDto,
  ContactResetPasswordDto,
} from './dto/contact-auth.dto';
import { ContactJwtAuthGuard } from './guards/contact-jwt-auth.guard';

@ApiTags('Contact Auth')
@Controller('contact-auth')
export class ContactAuthController {
  constructor(private contactAuthService: ContactAuthService) {}

  @Post('login')
  async login(@Body() dto: ContactLoginDto) {
    return this.contactAuthService.login(dto);
  }

  @Post('set-password')
  async setPassword(@Body() dto: ContactSetPasswordDto) {
    return this.contactAuthService.setPassword(dto);
  }

  @Post('reset/request')
  async requestPasswordReset(@Body() dto: ContactPasswordResetRequestDto) {
    return this.contactAuthService.requestPasswordReset(dto);
  }

  @Post('password-reset/request')
  async requestPasswordResetAlias(@Body() dto: ContactPasswordResetRequestDto) {
    return this.contactAuthService.requestPasswordReset(dto);
  }

  @Post('reset/confirm')
  async confirmPasswordReset(@Body() dto: ContactResetPasswordDto) {
    return this.contactAuthService.confirmPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  async confirmPasswordResetAlias(@Body() dto: ContactResetPasswordDto) {
    return this.contactAuthService.confirmPasswordReset(dto);
  }

  @Get('me')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentContact(@Request() req) {
    return req.user;
  }
}
