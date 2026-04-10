import { Controller, Get, Param, Query, Request, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { PaymentService } from '../services/payment.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { TransactionQueryDto } from '../dto/payment.dto';
import { Response } from 'express';

@ApiTags('Transactions')
@Controller('transactions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class TransactionsController {
  constructor(private paymentService: PaymentService) {}

  @Get()
  async listTransactions(
    @Request() req,
    @Query() query: TransactionQueryDto,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (query.format === 'csv' && res) {
      const csv = await this.paymentService.exportTransactions(req.user.organization_id, {
        status: query.status,
        reference: query.reference,
        form_id: query.form_id,
        contact_id: query.contact_id,
        payment_method: query.payment_method,
        start_date: query.start_date,
        end_date: query.end_date,
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="transactions.csv"');
      return csv;
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;

    return this.paymentService.findTransactions(req.user.organization_id, {
      status: query.status,
      reference: query.reference,
      form_id: query.form_id,
      contact_id: query.contact_id,
      payment_method: query.payment_method,
      start_date: query.start_date,
      end_date: query.end_date,
    },
    page,
    limit);
  }

  @Get(':id')
  async getTransaction(@Request() req, @Param('id') id: string) {
    return this.paymentService.findById(req.user.organization_id, id);
  }

  @Get(':id/history')
  async getTransactionHistory(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.paymentService.getTransactionHistory(req.user.organization_id, id, page, limit);
  }
}
