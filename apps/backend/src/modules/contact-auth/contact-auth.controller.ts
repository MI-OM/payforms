import { Controller, Post, Body, Get, UseGuards, Request, Param, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ContactAuthService } from './contact-auth.service';
import { PaymentService } from '../payment/services/payment.service';
import {
  ContactLoginDto,
  ContactSetPasswordDto,
  ContactPasswordResetRequestDto,
  ContactResetPasswordDto,
} from './dto/contact-auth.dto';
import { ContactJwtAuthGuard } from './guards/contact-jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Contact Auth')
@Controller('contact-auth')
export class ContactAuthController {
  constructor(
    private contactAuthService: ContactAuthService,
    private paymentService: PaymentService,
  ) {}

  @Post('login')
  async login(@Body() dto: ContactLoginDto, @Request() req) {
    return this.contactAuthService.login(dto, this.resolveRequestHost(req));
  }

  @Post('set-password')
  async setPassword(@Body() dto: ContactSetPasswordDto) {
    return this.contactAuthService.setPassword(dto);
  }

  @Post('reset/request')
  async requestPasswordReset(@Body() dto: ContactPasswordResetRequestDto, @Request() req) {
    return this.contactAuthService.requestPasswordReset(dto, this.resolveRequestHost(req));
  }

  @Post('password-reset/request')
  async requestPasswordResetAlias(@Body() dto: ContactPasswordResetRequestDto, @Request() req) {
    return this.contactAuthService.requestPasswordReset(dto, this.resolveRequestHost(req));
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

  @Get('payments/:id/receipt')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async downloadPaymentReceipt(
    @Request() req,
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.paymentService.generateContactReceiptByPaymentId(
      req.user.organization_id,
      req.user.id,
      id,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
    return receipt.content;
  }

  @Get('payments/reference/:reference/receipt')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async downloadPaymentReceiptByReference(
    @Request() req,
    @Param('reference') reference: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const receipt = await this.paymentService.generateContactReceiptByReference(
      req.user.organization_id,
      req.user.id,
      reference,
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${receipt.fileName}"`);
    return receipt.content;
  }

  private resolveRequestHost(req: any): string | null {
    const header =
      req?.headers?.['x-forwarded-host'] ||
      req?.headers?.host ||
      (typeof req?.get === 'function' ? req.get('host') : null);

    if (!header) {
      return null;
    }

    const firstValue = String(Array.isArray(header) ? header[0] : header)
      .split(',')[0]
      .trim();

    return firstValue || null;
  }
}
