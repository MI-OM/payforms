import { Controller, Post, Body, Get, UseGuards, Request, Param, Res, Query, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ContactAuthService } from './contact-auth.service';
import { PaymentService } from '../payment/services/payment.service';
import { ContactService } from '../contact/services/contact.service';
import { FormService } from '../form/services/form.service';
import { NotificationService } from '../notification/notification.service';
import {
  ContactLoginDto,
  ContactSetPasswordDto,
  ContactPasswordResetRequestDto,
  ContactResetPasswordDto,
} from './dto/contact-auth.dto';
import { ContactTransactionQueryDto } from '../contact/dto/contact.dto';
import { ContactJwtAuthGuard } from './guards/contact-jwt-auth.guard';
import { Response } from 'express';
import { ConfigService } from '@nestjs/config';

@ApiTags('Contact Auth')
@Controller('contact-auth')
@Throttle({ default: { limit: 30, ttl: 60000 } })
export class ContactAuthController {
  constructor(
    private contactAuthService: ContactAuthService,
    private paymentService: PaymentService,
    private contactService: ContactService,
    private formService: FormService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: ContactLoginDto, @Request() req, @Res({ passthrough: true }) res: Response) {
    const result = await this.contactAuthService.login(dto, this.resolveRequestHost(req));
    this.setContactCookie(res, result.access_token);
    return result;
  }

  @Post('set-password')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async setPassword(@Body() dto: ContactSetPasswordDto) {
    return this.contactAuthService.setPassword(dto);
  }

  @Post('reset/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestPasswordReset(@Body() dto: ContactPasswordResetRequestDto, @Request() req) {
    return this.contactAuthService.requestPasswordReset(dto, this.resolveRequestHost(req));
  }

  @Post('password-reset/request')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async requestPasswordResetAlias(@Body() dto: ContactPasswordResetRequestDto, @Request() req) {
    return this.contactAuthService.requestPasswordReset(dto, this.resolveRequestHost(req));
  }

  @Post('reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmPasswordReset(@Body() dto: ContactResetPasswordDto) {
    return this.contactAuthService.confirmPasswordReset(dto);
  }

  @Post('password-reset/confirm')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  async confirmPasswordResetAlias(@Body() dto: ContactResetPasswordDto) {
    return this.contactAuthService.confirmPasswordReset(dto);
  }

  @Post('logout')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async logout(@Res({ passthrough: true }) res: Response) {
    this.clearContactCookie(res);
    return { success: true };
  }

  @Get('me')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentContact(@Request() req) {
    return req.user;
  }

  @Get('forms')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentContactForms(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.formService.findAccessibleByContact(
      req.user.organization_id,
      req.user.id,
      Number(page),
      Number(limit),
    );
  }

  @Get('notifications')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentContactNotifications(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('unread_only') unreadOnly?: string,
  ) {
    return this.notificationService.listContactNotifications(
      req.user.organization_id,
      req.user.id,
      Number(page),
      Number(limit),
      unreadOnly === 'true',
    );
  }

  @Patch('notifications/:id/read')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async markCurrentContactNotificationRead(@Request() req, @Param('id') id: string) {
    return this.notificationService.markContactNotificationRead(
      req.user.organization_id,
      req.user.id,
      id,
    );
  }

  @Get('transactions')
  @UseGuards(ContactJwtAuthGuard)
  @ApiBearerAuth()
  async getCurrentContactTransactions(
    @Request() req,
    @Query() query: ContactTransactionQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (query.format === 'csv' && res) {
      const csv = await this.contactService.exportTransactionHistory(req.user.organization_id, req.user.id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="contact_transactions.csv"');
      return csv;
    }

    return this.contactService.getTransactionHistory(
      req.user.organization_id,
      req.user.id,
      query.page ?? 1,
      query.limit ?? 20,
    );
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
    const originHost = this.extractHostFromUrl(req?.headers?.origin || req?.headers?.referer);
    if (originHost) {
      return originHost;
    }

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

  private extractHostFromUrl(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value;
    if (!raw) {
      return null;
    }

    try {
      return new URL(raw).host;
    } catch {
      return null;
    }
  }

  private setContactCookie(res: Response, accessToken: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN') || undefined;
    res.cookie('pf_contact_token', accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      domain: cookieDomain,
      maxAge: this.parseDurationMs(this.configService.get('CONTACT_ACCESS_TOKEN_TTL', '8h'), 8 * 60 * 60 * 1000),
    });
  }

  private clearContactCookie(res: Response) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const cookieDomain = this.configService.get<string>('AUTH_COOKIE_DOMAIN') || undefined;
    res.clearCookie('pf_contact_token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: (isProduction ? 'none' : 'lax') as 'none' | 'lax',
      path: '/',
      domain: cookieDomain,
    });
  }

  private parseDurationMs(value: string, fallback: number) {
    const normalized = String(value || '').trim().toLowerCase();
    const match = normalized.match(/^(\d+)(ms|s|m|h|d)?$/);
    if (!match) {
      return fallback;
    }

    const amount = Number(match[1]);
    const unit = match[2] || 'ms';
    const multiplier = unit === 'd'
      ? 24 * 60 * 60 * 1000
      : unit === 'h'
        ? 60 * 60 * 1000
        : unit === 'm'
          ? 60 * 1000
          : unit === 's'
            ? 1000
            : 1;

    return amount * multiplier;
  }
}
