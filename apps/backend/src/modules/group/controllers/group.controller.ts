import { Controller, Get, Post, Patch, Delete, Body, UseGuards, Request, Param, Query } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { GroupService } from '../services/group.service';
import { CreateGroupDto, UpdateGroupDto, AddContactsToGroupDto } from '../dto/group.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

@ApiTags('Groups')
@Controller('groups')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class GroupController {
  constructor(private groupService: GroupService) {}

  @Post()
  async createGroup(@Request() req, @Body() dto: CreateGroupDto) {
    return this.groupService.create(req.user.organization_id, dto);
  }

  @Get()
  async listGroups(@Request() req, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.groupService.findByOrganization(req.user.organization_id, page, limit);
  }

  @Get('tree')
  async getGroupTree(@Request() req) {
    return this.groupService.findTree(req.user.organization_id);
  }

  @Get(':id')
  async getGroup(@Request() req, @Param('id') id: string) {
    return this.groupService.findById(req.user.organization_id, id);
  }

  @Patch(':id')
  async updateGroup(@Request() req, @Param('id') id: string, @Body() dto: UpdateGroupDto) {
    return this.groupService.update(req.user.organization_id, id, dto);
  }

  @Delete(':id')
  async deleteGroup(@Request() req, @Param('id') id: string) {
    return this.groupService.delete(req.user.organization_id, id);
  }

  @Post(':id/contacts')
  async addContactsToGroup(@Request() req, @Param('id') id: string, @Body() body: AddContactsToGroupDto) {
    return this.groupService.addContacts(req.user.organization_id, id, body.contact_ids);
  }

  @Get(':id/contacts')
  async getGroupContacts(@Request() req, @Param('id') id: string, @Query('page') page: number = 1, @Query('limit') limit: number = 20) {
    return this.groupService.getGroupContacts(req.user.organization_id, id, page, limit);
  }
}
