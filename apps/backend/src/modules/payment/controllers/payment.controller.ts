import { Controller, Get, Post, Body, UseGuards, Request, Param, Query, Res, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { CreatePaymentDto, UpdatePaymentStatusDto } from '../dto/payment.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { Response } from 'express';

@ApiTags('Payments')
@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async listPayments(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('format') format?: 'csv',
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (format === 'csv' && res) {
      const csv = await this.paymentService.exportByOrganization(req.user.organization_id);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="payments.csv"');
      return csv;
    }

    return this.paymentService.findByOrganization(req.user.organization_id, page, limit);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getPayment(@Request() req, @Param('id') id: string) {
    return this.paymentService.findById(req.user.organization_id, id);
  }

  @Get('verify/:reference')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async verifyPayment(@Request() req, @Param('reference') reference: string) {
    try {
      return await this.paymentService.verifyAndFinalizePayment(
        req.user.organization_id,
        reference,
        'manual_verify',
      );
    } catch (error) {
      if (error instanceof NotFoundException) {
        return { error: 'Payment not found' };
      }
      return { error: 'Verification failed' };
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async createPayment(@Request() req, @Body() dto: CreatePaymentDto) {
    return this.paymentService.create(req.user.organization_id, dto);
  }

  @Post(':id/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updatePaymentStatus(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdatePaymentStatusDto,
  ) {
    return this.paymentService.updateStatus(req.user.organization_id, id, dto);
  }
}
