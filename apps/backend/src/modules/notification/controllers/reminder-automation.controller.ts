import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Request,
  UseGuards,
  HttpCode,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ReminderAutomationService, CreateReminderPolicyDto, UpdateReminderPolicyDto } from '../services/reminder-automation.service';

@ApiTags('Reminder Automation')
@Controller('reminders/policies')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ReminderAutomationController {
  constructor(private readonly reminderService: ReminderAutomationService) {}

  /**
   * Create a new reminder policy.
   * Policies define when and who should receive payment reminders.
   */
  @Post()
  @ApiOperation({
    summary: 'Create a new reminder policy',
    description: `Create an automated reminder policy that sends reminders when:
    - Contact has outstanding balance >= balance_due_threshold
    - And balance is overdue for >= days_overdue_threshold days
    
    Message template supports placeholders:
    - {{contact_first_name}}, {{contact_full_name}}
    - {{balance_due}}, {{days_overdue}}
    `,
  })
  async createPolicy(@Request() req, @Body() dto: CreateReminderPolicyDto) {
    return this.reminderService.createPolicy(req.user.organization_id, dto);
  }

  /**
   * List all reminder policies for the organization.
   */
  @Get()
  @ApiOperation({ summary: 'List all reminder policies' })
  async listPolicies(@Request() req) {
    return this.reminderService.listPolicies(req.user.organization_id);
  }

  /**
   * Get a specific reminder policy.
   */
  @Get(':policyId')
  @ApiOperation({ summary: 'Get a specific reminder policy' })
  async getPolicy(@Request() req, @Param('policyId') policyId: string) {
    return this.reminderService.getPolicy(req.user.organization_id, policyId);
  }

  /**
   * Update a reminder policy.
   */
  @Patch(':policyId')
  @ApiOperation({ summary: 'Update a reminder policy' })
  async updatePolicy(
    @Request() req,
    @Param('policyId') policyId: string,
    @Body() dto: UpdateReminderPolicyDto,
  ) {
    return this.reminderService.updatePolicy(req.user.organization_id, policyId, dto);
  }

  /**
   * Delete a reminder policy.
   */
  @Delete(':policyId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete a reminder policy' })
  async deletePolicy(@Request() req, @Param('policyId') policyId: string) {
    await this.reminderService.deletePolicy(req.user.organization_id, policyId);
  }

  /**
   * Get reminder send history for a contact.
   */
  @Get('history/:contactId')
  @ApiOperation({ summary: 'Get reminder send history for a contact' })
  async getContactHistory(
    @Request() req,
    @Param('contactId') contactId: string,
    @Query('limit') limit?: number,
  ) {
    return this.reminderService.getContactReminderHistory(
      req.user.organization_id,
      contactId,
      limit ?? 20,
    );
  }
}
