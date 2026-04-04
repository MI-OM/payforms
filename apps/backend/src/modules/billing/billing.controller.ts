import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plans/:organizationId')
  async getPlan(@Param('organizationId') organizationId: string) {
    const plan = await this.billingService.getOrganizationPlan(organizationId);
    return { plan };
  }

  @Get('usage/:organizationId')
  async getUsage(@Param('organizationId') organizationId: string) {
    const usage = await this.billingService.calculateUsage(organizationId);
    return { usage };
  }

  @Get('report/:organizationId')
  async getReport(@Param('organizationId') organizationId: string) {
    const report = await this.billingService.getUsageReport(organizationId);
    return report;
  }

  @Post('upgrade/:organizationId')
  async upgradePlan(
    @Param('organizationId') organizationId: string,
    @Body() body: { newPlanTier: string },
  ) {
    const updated = await this.billingService.upgradePlan(organizationId, body.newPlanTier);
    return { organization: updated };
  }
}
