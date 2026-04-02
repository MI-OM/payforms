import { Controller, Get, Patch, Post, Body, UseGuards, Request, Param } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrganizationService } from '../services/organization.service';
import { UpdateOrganizationDto, UpdateOrganizationKeysDto, UploadLogoDto } from '../dto/organization.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';

@ApiTags('Organization')
@Controller('organization')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrganizationController {
  constructor(private organizationService: OrganizationService) {}

  @Get()
  @Roles('ADMIN', 'STAFF')
  async getOrganization(@Request() req) {
    return this.organizationService.findById(req.user.organization_id);
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
}
