import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Audit')
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('ADMIN')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get('logs')
  async getActivityLogs(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('action') action?: string,
    @Query('entity_type') entity_type?: string,
    @Query('entity_id') entity_id?: string,
    @Query('user_id') user_id?: string,
    @Query('ip_address') ip_address?: string,
    @Query('user_agent') user_agent?: string,
    @Query('keyword') keyword?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const result = await this.auditService.listActivityLogs(req.user.organization_id, page, limit, {
      action,
      entity_type,
      entity_id,
      user_id,
      ip_address,
      user_agent,
      keyword,
      from,
      to,
    });

    return {
      ...result,
      data: result.data.map(item => ({
        ...item,
        timestamp: item.created_at,
        entity: item.entity_type,
        user: this.auditService.formatActor(item),
      })),
    };
  }

  @Get('payment-logs/:payment_id')
  async getPaymentLogs(
    @Request() req,
    @Param('payment_id') paymentId: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('event') event?: string,
    @Query('event_id') event_id?: string,
    @Query('keyword') keyword?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.auditService.listPaymentLogs(req.user.organization_id, paymentId, page, limit, {
      event,
      event_id,
      keyword,
      from,
      to,
    });
  }
}
