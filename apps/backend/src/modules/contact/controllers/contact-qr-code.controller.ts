import {
  Controller,
  Get,
  Post,
  Param,
  Request,
  UseGuards,
  HttpCode,
  BadRequestException,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ContactQrCodeService } from '../services/contact-qr-code.service';
import { ConfigService } from '@nestjs/config';

/**
 * QR Code controller for payment status access.
 *
 * Three access modes:
 * 1. PUBLIC (/qr/view/public/{qr_token}):
 *    - No authentication required
 *    - Shows basic payment status: total balance, payment summary
 *    - Useful for quick checks from phone/printed card
 *
 * 2. AUTHENTICATED (/qr/view/authenticated/{qr_token}):
 *    - Contact must login
 *    - Shows detailed payment breakdown by form
 *    - Contact can verify their own QR code security
 *
 * 3. STAFF (/qr/scan/{qr_token}):
 *    - School staff/admin only (JwtAuthGuard)
 *    - Shows full contact and payment details
 *    - Used when staff scans QR to check student payment status
 */
@ApiTags('QR Code Payment Status')
@Controller('qr')
export class ContactQrCodeController {
  constructor(
    private readonly qrCodeService: ContactQrCodeService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * PUBLIC: View payment status from QR code (no auth required).
   * Minimal information: contact name, total balance, recent payments summary.
   */
  @Get('view/public/:qr_token')
  @ApiOperation({
    summary: 'View payment status from QR code (public, no login required)',
    description: `Access contact payment status using QR token.
    Returns: Contact name, total balance due, payment summary.
    No authentication required - perfect for quick checks from printed QR codes.`,
  })
  async viewPublic(@Param('qr_token') qrToken: string, @Req() req: any) {
    if (!qrToken?.trim()) {
      throw new BadRequestException('Invalid QR token');
    }

    const qrCode = await this.qrCodeService.getQrCodeByToken(qrToken);
    if (!qrCode) {
      throw new BadRequestException('QR code not found or inactive');
    }

    // Record scan
    await this.qrCodeService.recordScan(
      qrCode.id,
      qrCode.organization_id,
      qrCode.contact_id,
      'public',
      {
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
      },
    );

    // Get payment status
    const status = await this.qrCodeService.getContactPaymentStatus(
      qrCode.organization_id,
      qrCode.contact_id,
    );

    // Return minimal information for public view
    return {
      contact_name: status.contact_name,
      student_id: status.student_id,
      total_balance_due: status.total_balance_due,
      payment_summary: {
        total_payments: status.payments.length,
        paid: status.payments.filter(p => p.status === 'PAID').length,
        pending: status.payments.filter(p => p.status === 'PENDING').length,
        partial: status.payments.filter(p => p.status === 'PARTIAL').length,
      },
    };
  }

  /**
   * AUTHENTICATED: View detailed payment status (contact logged in).
   * Full payment breakdown by form, with transaction history.
   */
  @Get('view/authenticated/:qr_token')
  @ApiOperation({
    summary: 'View detailed payment status (authenticated contact)',
    description: `Access contact's detailed payment status after QR login.
    Returns: Full payment breakdown by form, transaction history.
    Contact can verify their own QR code and payment status.`,
  })
  async viewAuthenticated(@Param('qr_token') qrToken: string, @Req() req: any) {
    if (!qrToken?.trim()) {
      throw new BadRequestException('Invalid QR token');
    }

    const qrCode = await this.qrCodeService.getQrCodeByToken(qrToken);
    if (!qrCode) {
      throw new BadRequestException('QR code not found or inactive');
    }

    // Record scan
    await this.qrCodeService.recordScan(
      qrCode.id,
      qrCode.organization_id,
      qrCode.contact_id,
      'authenticated',
      {
        ipAddress: this.getClientIp(req),
        userAgent: req.get('user-agent'),
      },
    );

    // Get full payment status
    return this.qrCodeService.getContactPaymentStatus(
      qrCode.organization_id,
      qrCode.contact_id,
    );
  }

  /**
   * STAFF: Scan QR to view contact payment status (staff authenticated).
   * Staff can scan to check student payment status.
   */
  @Post('scan/:qr_token')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Staff scans QR code to view contact payment status',
    description: `School staff/admin scans QR code to check student payment status.
    Returns: Full contact and payment details.
    Requires staff authentication (JWT).`,
  })
  async scanQr(@Param('qr_token') qrToken: string, @Request() req, @Req() httpReq: any) {
    if (!qrToken?.trim()) {
      throw new BadRequestException('Invalid QR token');
    }

    const qrCode = await this.qrCodeService.getQrCodeByToken(qrToken);
    if (!qrCode) {
      throw new BadRequestException('QR code not found or inactive');
    }

    // Verify staff is in the same organization
    if (req.user.organization_id !== qrCode.organization_id) {
      throw new BadRequestException('Cannot access QR code from different organization');
    }

    // Record scan with staff user info
    await this.qrCodeService.recordScan(
      qrCode.id,
      qrCode.organization_id,
      qrCode.contact_id,
      'staff',
      {
        scannedByUserId: req.user.id,
        ipAddress: this.getClientIp(httpReq),
        userAgent: httpReq.get('user-agent'),
      },
    );

    // Get full payment status
    return this.qrCodeService.getContactPaymentStatus(
      qrCode.organization_id,
      qrCode.contact_id,
    );
  }

  /**
   * Get or create QR code for a contact.
   * Used by org admin to generate QR codes for printing.
   */
  @Post('generate/:contactId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate QR code for a contact' })
  async generateQrCode(@Param('contactId') contactId: string, @Request() req) {
    const qrCode = await this.qrCodeService.getOrCreateQrCode(
      req.user.organization_id,
      contactId,
    );

    const baseUrl = this.configService.get<string>('PUBLIC_API_BASE_URL') || 'https://api.payforms.com.ng';
    const displayData = await this.qrCodeService.getQrCodeDisplayData(
      req.user.organization_id,
      contactId,
      baseUrl,
    );

    return displayData;
  }

  /**
   * Get QR code details for a contact (admin view).
   */
  @Get('details/:contactId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code details for a contact' })
  async getQrCodeDetails(@Param('contactId') contactId: string, @Request() req) {
    const baseUrl = this.configService.get<string>('PUBLIC_API_BASE_URL') || 'https://api.payforms.com.ng';
    return this.qrCodeService.getQrCodeDisplayData(
      req.user.organization_id,
      contactId,
      baseUrl,
    );
  }

  /**
   * Regenerate QR code token (if compromised).
   */
  @Post('regenerate/:contactId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Regenerate QR code token (security measure)' })
  async regenerateQrToken(@Param('contactId') contactId: string, @Request() req) {
    const qrCode = await this.qrCodeService.regenerateQrToken(
      req.user.organization_id,
      contactId,
    );

    const baseUrl = this.configService.get<string>('PUBLIC_API_BASE_URL') || 'https://api.payforms.com.ng';
    return {
      qr_code: qrCode,
      qr_url: this.qrCodeService.getQrCodeUrl(qrCode.qr_token, baseUrl),
      message: 'QR code token regenerated. Old token is now inactive.',
    };
  }

  /**
   * Get scan history for a contact's QR code.
   */
  @Get('scan-history/:contactId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get QR code scan history for a contact' })
  async getScanHistory(@Param('contactId') contactId: string, @Request() req) {
    return this.qrCodeService.getScanHistory(req.user.organization_id, contactId);
  }

  /**
   * Disable QR code (soft delete).
   */
  @Post('disable/:contactId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable QR code temporarily' })
  async disableQrCode(@Param('contactId') contactId: string, @Request() req) {
    await this.qrCodeService.disableQrCode(req.user.organization_id, contactId);
  }

  /**
   * Enable a disabled QR code.
   */
  @Post('enable/:contactId')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable a disabled QR code' })
  async enableQrCode(@Param('contactId') contactId: string, @Request() req) {
    await this.qrCodeService.enableQrCode(req.user.organization_id, contactId);
  }

  /**
   * Helper to extract client IP from request.
   */
  private getClientIp(req: any): string | null {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      req.socket?.remoteAddress ||
      req.connection?.remoteAddress ||
      null
    );
  }
}
