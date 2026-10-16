import { Controller, Get, Patch, Post, Delete, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { OrganizationEntitlementsService } from '../organization-entitlements.service';
import { BillingService } from '../../billing/billing.service';
import { UpdateOrganizationDto, UpdateOrganizationKeysDto, UploadLogoDto } from '../dto/organization.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Organization')
@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(
    private organizationService: OrganizationService,
    private organizationEntitlementsService: OrganizationEntitlementsService,
    private billingService: BillingService,
  ) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  async getOrganization(@Request() req) {
    return this.organizationService.findById(req.user.organization_id);
  }

  /**
   * Tenant-scoped view of this organization's effective limits (plan defaults
   * merged with any platform-negotiated overrides). Mirrors the platform
   * console's entitlements view so the two screens stay in sync; read-only —
   * only the platform console can set or clear overrides.
   */
  @Get('entitlements')
  @Roles('ADMIN', 'STAFF')
  async getEntitlements(@Request() req) {
    const organizationId: string = req.user.organization_id;
    const org = await this.organizationService.findById(organizationId);
    const plan = this.billingService.getPlanLimits(org?.billing_plan_tier);
    if (!plan) {
      // Unknown tier: fall back to the free plan rather than 500ing the page.
      const freePlan = this.billingService.getPlanLimits('free');
      return {
        organization_id: organizationId,
        plan: 'free',
        plan_name: freePlan?.name ?? 'Free',
        overrides: null,
        effective: {
          soft_limits: freePlan?.soft_limits ?? {},
          hard_limits: freePlan?.hard_limits ?? {},
        },
      };
    }

    const override = await this.organizationEntitlementsService.getForOrganization(organizationId);
    const effective = this.organizationEntitlementsService.mergePlanWithOverrides(plan, override);

    return {
      organization_id: organizationId,
      plan: plan.tier,
      plan_name: plan.name,
      overrides: override
        ? {
            contacts_limit: override.contacts_limit,
            forms_limit: override.forms_limit,
            staff_users_limit: override.staff_users_limit,
            monthly_submissions_limit: override.monthly_submissions_limit,
            monthly_email_sends_limit: override.monthly_email_sends_limit,
            storage_gb_limit: override.storage_gb_limit,
            notes: override.notes,
          }
        : null,
      effective: {
        soft_limits: effective.soft_limits,
        hard_limits: effective.hard_limits,
      },
    };
  }

  @Patch()
  @Roles('ADMIN')
  async updateOrganization(@Request() req, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(req.user.organization_id, dto);
  }

  @Get('settings')
  @Roles('ADMIN', 'STAFF')
  async getSettings(@Request() req) {
    return this.organizationService.getSettings(req.user.organization_id);
  }

  @Patch('settings')
  @Roles('ADMIN')
  async updateSettings(@Request() req, @Body() dto: UpdateOrganizationDto) {
    return this.organizationService.update(req.user.organization_id, dto);
  }

  @Patch('keys')
  @Roles('ADMIN')
  async updatePaystackKeys(@Request() req, @Body() dto: UpdateOrganizationKeysDto) {
    return this.organizationService.updatePaystackKeys(req.user.organization_id, dto);
  }

  @Post('logo')
  @Roles('ADMIN')
  async uploadLogo(@Request() req, @Body() body: UploadLogoDto) {
    return this.organizationService.uploadLogo(req.user.organization_id, body.logo_url);
  }

  @Delete()
  @Roles('ADMIN')
  async deleteOrganization(@Request() req) {
    return this.organizationService.delete(req.user.organization_id, req.user);
  }
}
