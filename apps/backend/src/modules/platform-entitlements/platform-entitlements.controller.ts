import { Body, Controller, Delete, Get, HttpCode, Param, Put, Request, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PlatformEntitlementsService } from './platform-entitlements.service';
import { SetOrganizationEntitlementsDto } from './dto/platform-entitlements.dto';
import { PlatformJwtAuthGuard } from '../platform-auth/guards/platform-jwt-auth.guard';
import { PlatformRolesGuard } from '../platform-auth/guards/platform-roles.guard';
import { PlatformRoles } from '../platform-auth/decorators/platform-roles.decorator';
import { PlatformAuditInterceptor } from '../platform-audit/platform-audit.interceptor';
import { PlatformAuditAction } from '../platform-audit/decorators/platform-audit.decorator';

/**
 * Manual per-organization entitlements console (Part 3, Module 8).
 *
 * View the effective limits (plan defaults + negotiated overrides) and
 * set/clear them — plus optionally change the billing tier — while the full
 * billing stack (Part 1) is being decided. SUPER-only; every mutation is
 * audited.
 */
@ApiTags('Platform Admin')
@Controller('platform/organizations/:organizationId/entitlements')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
@UseInterceptors(PlatformAuditInterceptor)
export class PlatformEntitlementsController {
  constructor(private readonly platformEntitlementsService: PlatformEntitlementsService) {}

  @Get()
  async view(@Param('organizationId') organizationId: string) {
    return this.platformEntitlementsService.view(organizationId);
  }

  @Put()
  @PlatformAuditAction('SET ORGANIZATION ENTITLEMENTS', 'Organization')
  async set(
    @Param('organizationId') organizationId: string,
    @Body() dto: SetOrganizationEntitlementsDto,
    @Request() req: any,
  ) {
    return this.platformEntitlementsService.set(
      organizationId,
      dto,
      { id: req.user?.id ?? null, email: req.user?.email ?? null },
    );
  }

  @Delete()
  @HttpCode(200)
  @PlatformAuditAction('CLEAR ORGANIZATION ENTITLEMENTS', 'Organization')
  async clear(@Param('organizationId') organizationId: string) {
    return this.platformEntitlementsService.clear(organizationId);
  }
}

/**
 * Read-only view of the in-code billing catalog so the console does not
 * hardcode plan names. Replaced by Part 1's versioned plan table later.
 */
@ApiTags('Platform Admin')
@Controller('platform/plans')
@UseGuards(PlatformJwtAuthGuard, PlatformRolesGuard)
@ApiBearerAuth()
@PlatformRoles('SUPER')
export class PlatformPlansController {
  constructor(private readonly platformEntitlementsService: PlatformEntitlementsService) {}

  @Get()
  async list() {
    return { data: this.platformEntitlementsService.listPlans() };
  }
}
