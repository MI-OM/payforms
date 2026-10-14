import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Request,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Billing')
@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class BillingController {
  constructor(private billingService: BillingService) {}

  /**
   * Billing data is tenant-scoped. Callers may only ever act on their own
   * organization, regardless of the organization id present in the path.
   */
  private resolveOrganizationId(req: any, organizationId: string): string {
    const callerOrganizationId = req?.user?.organization_id;
    if (!callerOrganizationId || callerOrganizationId !== organizationId) {
      throw new ForbiddenException('You can only access billing for your own organization');
    }
    return callerOrganizationId;
  }

  @Get('plans/:organizationId')
  @Roles('ADMIN', 'STAFF')
  async getPlan(@Request() req, @Param('organizationId') organizationId: string) {
    const plan = await this.billingService.getOrganizationPlan(
      this.resolveOrganizationId(req, organizationId),
    );
    return { plan };
  }

  @Get('usage/:organizationId')
  @Roles('ADMIN', 'STAFF')
  async getUsage(@Request() req, @Param('organizationId') organizationId: string) {
    const usage = await this.billingService.calculateUsage(
      this.resolveOrganizationId(req, organizationId),
    );
    return { usage };
  }

  @Get('report/:organizationId')
  @Roles('ADMIN', 'STAFF')
  async getReport(@Request() req, @Param('organizationId') organizationId: string) {
    const report = await this.billingService.getUsageReport(
      this.resolveOrganizationId(req, organizationId),
    );
    return report;
  }

  @Post('upgrade/:organizationId')
  @Roles('ADMIN')
  async upgradePlan(
    @Request() req,
    @Param('organizationId') organizationId: string,
    @Body() body: { newPlanTier: string },
  ) {
    const updated = await this.billingService.upgradePlan(
      this.resolveOrganizationId(req, organizationId),
      body.newPlanTier,
    );
    return { organization: updated };
  }
}
