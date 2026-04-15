import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { MarketReadinessService } from '../market-readiness.service';
import {
  AssignInstallmentContactsDto,
  CreatePartnerDto,
  CreateIntegrationEndpointDto,
  CreateReconciliationRunDto,
  CreateInstallmentPlanDto,
  CreateCheckoutSessionDto,
  OnboardPartnerOrganizationDto,
  RecoveryRunDto,
  UpdateIntegrationEndpointDto,
  UpdateReconciliationExceptionDto,
  UpdateInstallmentPlanDto,
  UpdateCheckoutSessionDto,
  UpdateMarketReadinessFlagsDto,
  CreateDunningCampaignDto,
  UpdateDunningCampaignDto,
  RunDunningCampaignDto,
  CreateComplianceExportPackDto,
} from '../dto/market-readiness.dto';

@ApiTags('Market Readiness v1')
@Controller({ path: 'market', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MarketReadinessController {
  constructor(private readonly marketReadinessService: MarketReadinessService) {}

  @Get('features')
  @Roles('ADMIN', 'STAFF')
  async getFeatures(@Request() req) {
    return this.marketReadinessService.getFlags(req.user.organization_id);
  }

  @Patch('features')
  @Roles('ADMIN')
  async updateFeatures(@Request() req, @Body() dto: UpdateMarketReadinessFlagsDto) {
    return this.marketReadinessService.updateFlags(req.user.organization_id, dto.flags || {});
  }

  @Post('checkout/sessions')
  @Roles('ADMIN', 'STAFF')
  async createCheckoutSession(@Request() req, @Body() dto: CreateCheckoutSessionDto) {
    return this.marketReadinessService.createCheckoutSession(req.user.organization_id, dto);
  }

  @Patch('checkout/sessions/:id')
  @Roles('ADMIN', 'STAFF')
  async updateCheckoutSession(@Request() req, @Param('id') id: string, @Body() dto: UpdateCheckoutSessionDto) {
    return this.marketReadinessService.updateCheckoutSession(req.user.organization_id, id, dto.status);
  }

  @Get('checkout/sessions/metrics')
  @Roles('ADMIN', 'STAFF')
  async getCheckoutMetrics(@Request() req) {
    return this.marketReadinessService.getCheckoutMetrics(req.user.organization_id);
  }

  @Get('payments/recovery/candidates')
  @Roles('ADMIN', 'STAFF')
  async listRecoveryCandidates(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.marketReadinessService.listRecoveryCandidates(req.user.organization_id, Number(page), Number(limit));
  }

  @Post('payments/recovery/:id/notify')
  @Roles('ADMIN')
  async notifyRecoveryCandidate(@Request() req, @Param('id') id: string) {
    return this.marketReadinessService.notifyRecoveryCandidate(req.user.organization_id, id);
  }

  @Post('payments/recovery/run')
  @Roles('ADMIN')
  async runRecovery(@Request() req, @Body() dto: RecoveryRunDto) {
    return this.marketReadinessService.runRecovery(req.user.organization_id, Boolean(dto.dry_run));
  }

  @Post('installments/plans')
  @Roles('ADMIN')
  async createInstallmentPlan(@Request() req, @Body() dto: CreateInstallmentPlanDto) {
    return this.marketReadinessService.createInstallmentPlan(req.user.organization_id, dto);
  }

  @Get('installments/plans')
  @Roles('ADMIN', 'STAFF')
  async listInstallmentPlans(@Request() req) {
    return this.marketReadinessService.listInstallmentPlans(req.user.organization_id);
  }

  @Get('installments/plans/:id')
  @Roles('ADMIN', 'STAFF')
  async getInstallmentPlan(@Request() req, @Param('id') id: string) {
    return this.marketReadinessService.getInstallmentPlan(req.user.organization_id, id);
  }

  @Patch('installments/plans/:id')
  @Roles('ADMIN')
  async updateInstallmentPlan(@Request() req, @Param('id') id: string, @Body() dto: UpdateInstallmentPlanDto) {
    return this.marketReadinessService.updateInstallmentPlan(req.user.organization_id, id, dto);
  }

  @Post('installments/plans/:id/assign-contacts')
  @Roles('ADMIN')
  async assignInstallmentPlanContacts(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: AssignInstallmentContactsDto,
  ) {
    return this.marketReadinessService.assignInstallmentPlanContacts(
      req.user.organization_id,
      id,
      dto.contact_ids,
    );
  }

  @Get('installments/accounts')
  @Roles('ADMIN', 'STAFF')
  async listInstallmentAccounts(@Request() req, @Query('plan_id') planId?: string) {
    return this.marketReadinessService.listInstallmentAccounts(req.user.organization_id, planId);
  }

  @Post('reconciliation/runs')
  @Roles('ADMIN')
  async createReconciliationRun(@Request() req, @Body() dto: CreateReconciliationRunDto) {
    return this.marketReadinessService.createReconciliationRun(req.user.organization_id, dto);
  }

  @Get('reconciliation/runs')
  @Roles('ADMIN', 'STAFF')
  async listReconciliationRuns(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.marketReadinessService.listReconciliationRuns(req.user.organization_id, Number(page), Number(limit));
  }

  @Get('reconciliation/runs/:id/exceptions')
  @Roles('ADMIN', 'STAFF')
  async listReconciliationExceptions(
    @Request() req,
    @Param('id') id: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
  ) {
    return this.marketReadinessService.listReconciliationExceptions(
      req.user.organization_id,
      id,
      Number(page),
      Number(limit),
    );
  }

  @Patch('reconciliation/exceptions/:id')
  @Roles('ADMIN')
  async updateReconciliationException(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateReconciliationExceptionDto,
  ) {
    return this.marketReadinessService.updateReconciliationException(req.user.organization_id, id, dto);
  }

  @Post('integrations/endpoints')
  @Roles('ADMIN')
  async createIntegrationEndpoint(@Request() req, @Body() dto: CreateIntegrationEndpointDto) {
    return this.marketReadinessService.createIntegrationEndpoint(req.user.organization_id, dto);
  }

  @Get('integrations/endpoints')
  @Roles('ADMIN', 'STAFF')
  async listIntegrationEndpoints(@Request() req) {
    return this.marketReadinessService.listIntegrationEndpoints(req.user.organization_id);
  }

  @Patch('integrations/endpoints/:id')
  @Roles('ADMIN')
  async updateIntegrationEndpoint(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateIntegrationEndpointDto,
  ) {
    return this.marketReadinessService.updateIntegrationEndpoint(req.user.organization_id, id, dto);
  }

  @Get('integrations/deliveries')
  @Roles('ADMIN', 'STAFF')
  async listIntegrationDeliveries(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('endpoint_id') endpointId?: string,
  ) {
    return this.marketReadinessService.listIntegrationDeliveries(
      req.user.organization_id,
      Number(page),
      Number(limit),
      endpointId,
    );
  }

  @Post('partners')
  @Roles('ADMIN')
  async createPartner(@Request() req, @Body() dto: CreatePartnerDto) {
    return this.marketReadinessService.createPartner(req.user.organization_id, dto);
  }

  @Get('partners')
  @Roles('ADMIN', 'STAFF')
  async listPartners(@Request() req) {
    return this.marketReadinessService.listPartners(req.user.organization_id);
  }

  @Post('partners/:id/onboard-organization')
  @Roles('ADMIN')
  async onboardPartnerOrganization(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: OnboardPartnerOrganizationDto,
  ) {
    return this.marketReadinessService.onboardPartnerOrganization(req.user.organization_id, id, dto);
  }

  @Post('campaigns')
  @Roles('ADMIN')
  async createDunningCampaign(
    @Request() req,
    @Body() dto: CreateDunningCampaignDto,
  ) {
    return this.marketReadinessService.createDunningCampaign(req.user.organization_id, dto);
  }

  @Get('campaigns')
  @Roles('ADMIN', 'STAFF')
  async listDunningCampaigns(@Request() req) {
    return this.marketReadinessService.listDunningCampaigns(req.user.organization_id);
  }

  @Get('campaigns/:id')
  @Roles('ADMIN', 'STAFF')
  async getDunningCampaign(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.marketReadinessService.getDunningCampaign(req.user.organization_id, id);
  }

  @Patch('campaigns/:id')
  @Roles('ADMIN')
  async updateDunningCampaign(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: UpdateDunningCampaignDto,
  ) {
    return this.marketReadinessService.updateDunningCampaign(req.user.organization_id, id, dto);
  }

  @Post('campaigns/:id/run')
  @Roles('ADMIN')
  async runDunningCampaign(
    @Request() req,
    @Param('id') id: string,
    @Body() dto: RunDunningCampaignDto,
  ) {
    return this.marketReadinessService.runDunningCampaign(req.user.organization_id, id, dto);
  }

  @Get('campaigns/:id/runs')
  @Roles('ADMIN', 'STAFF')
  async listDunningRuns(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.marketReadinessService.listDunningRuns(req.user.organization_id, id);
  }

  @Get('runs/:runId/snapshots')
  @Roles('ADMIN', 'STAFF')
  async listArrearsSnapshots(
    @Request() req,
    @Param('runId') runId: string,
  ) {
    return this.marketReadinessService.listArrearsSnapshots(req.user.organization_id, runId);
  }

  @Post('compliance/export-pack')
  @Roles('ADMIN')
  async createComplianceExportPackJob(
    @Request() req,
    @Body() dto: CreateComplianceExportPackDto,
  ) {
    return this.marketReadinessService.createComplianceExportPackJob(
      req.user.organization_id,
      req.user.id,
      dto,
    );
  }

  @Get('compliance/export-pack/jobs')
  @Roles('ADMIN', 'STAFF')
  async listComplianceExportPackJobs(
    @Request() req,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 20,
    @Query('status') status?: string,
  ) {
    return this.marketReadinessService.listComplianceExportPackJobs(
      req.user.organization_id,
      Number(page),
      Number(limit),
      status,
    );
  }

  @Get('compliance/export-pack/jobs/:id')
  @Roles('ADMIN', 'STAFF')
  async getComplianceExportPackJob(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.marketReadinessService.getComplianceExportPackJob(req.user.organization_id, id);
  }

  @Post('compliance/export-pack/jobs/:id/process')
  @Roles('ADMIN')
  async processComplianceExportPackJob(
    @Request() req,
    @Param('id') id: string,
  ) {
    return this.marketReadinessService.processComplianceExportPackJob(req.user.organization_id, req.user.id, id);
  }
}
