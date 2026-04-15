import { Controller, Get, Query, Param, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from '../services/audit.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ActivityLogQueryDto, PaymentLogQueryDto } from '../dto/audit.dto';

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
    @Query() query: ActivityLogQueryDto,
  ) {
    const result = await this.auditService.listActivityLogs(req.user.organization_id, query.page ?? 1, query.limit ?? 20, {
      action: query.action,
      entity_type: query.entity_type,
      entity_id: query.entity_id,
      user_id: query.user_id,
      contact_id: query.contact_id,
      ip_address: query.ip_address,
      user_agent: query.user_agent,
      keyword: query.keyword,
      from: query.from,
      to: query.to,
    });

    return {
      ...result,
      data: result.data.map(item => {
        const actor = this.auditService.formatActor(item);
        const entity = this.auditService.formatEntity(item);
        return {
          ...item,
          timestamp: item.created_at,
          actor,
          user: actor,
          entity: item.entity_type,
          entity_details: entity,
          entity_label: entity.label,
        };
      }),
    };
  }

  @Get('payment-logs/:payment_id')
  async getPaymentLogs(
    @Request() req,
    @Param('payment_id') paymentId: string,
    @Query() query: PaymentLogQueryDto,
  ) {
    return this.auditService.listPaymentLogs(req.user.organization_id, paymentId, query.page ?? 1, query.limit ?? 20, {
      event: query.event,
      event_id: query.event_id,
      keyword: query.keyword,
      from: query.from,
      to: query.to,
    });
  }
}
