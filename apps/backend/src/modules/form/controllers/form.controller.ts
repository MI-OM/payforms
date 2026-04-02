import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FormService } from '../services/form.service';
import { CreateFormDto, UpdateFormDto, CreateFormFieldDto, UpdateFormFieldDto, ReorderFieldsDto, AssignFormTargetsDto, AssignFormGroupsDto } from '../dto/form.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Forms')
@Controller('forms')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FormController {
  constructor(private formService: FormService) {}

  @Post()
  async createForm(@Request() req, @Body() dto: CreateFormDto) {
    return this.formService.create(req.user.organization_id, dto);
  }

  @Get()
  async listForms(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.formService.findByOrganization(req.user.organization_id, page, limit);
  }

  @Get(':id')
  async getForm(@Request() req, @Param('id') id: string) {
    return this.formService.findById(req.user.organization_id, id);
  }

  @Patch(':id')
  async updateForm(@Request() req, @Param('id') id: string, @Body() dto: UpdateFormDto) {
    return this.formService.update(req.user.organization_id, id, dto);
  }

  @Delete(':id')
  async deleteForm(@Request() req, @Param('id') id: string) {
    return this.formService.delete(req.user.organization_id, id);
  }

  @Post(':id/fields')
  async addField(@Request() req, @Param('id') id: string, @Body() dto: CreateFormFieldDto) {
    return this.formService.addField(req.user.organization_id, id, dto);
  }

  @Patch('fields/:fieldId')
  async updateField(@Request() req, @Param('fieldId') fieldId: string, @Body() dto: UpdateFormFieldDto) {
    return this.formService.updateField(req.user.organization_id, fieldId, dto);
  }

  @Delete('fields/:fieldId')
  async deleteField(@Request() req, @Param('fieldId') fieldId: string) {
    return this.formService.deleteField(req.user.organization_id, fieldId);
  }

  @Patch(':id/fields/reorder')
  async reorderFields(@Request() req, @Param('id') id: string, @Body() dto: ReorderFieldsDto) {
    return this.formService.reorderFields(req.user.organization_id, id, dto);
  }

  @Post(':id/groups')
  async assignToGroups(@Request() req, @Param('id') id: string, @Body() body: AssignFormGroupsDto) {
    return this.formService.assignToGroups(req.user.organization_id, id, body.group_ids);
  }

  @Get(':id/groups')
  async getGroups(@Request() req, @Param('id') id: string) {
    return this.formService.getGroups(req.user.organization_id, id);
  }

  @Get(':id/targets')
  async getTargets(@Request() req, @Param('id') id: string) {
    return this.formService.getTargets(req.user.organization_id, id);
  }

  @Post(':id/targets')
  async assignTargets(@Request() req, @Param('id') id: string, @Body() dto: AssignFormTargetsDto) {
    return this.formService.assignTargets(req.user.organization_id, id, dto);
  }

  @Delete(':id/targets/:targetId')
  async removeTarget(@Request() req, @Param('id') id: string, @Param('targetId') targetId: string) {
    return this.formService.removeTarget(req.user.organization_id, id, targetId);
  }
}
