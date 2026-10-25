import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { OrganizationReminderPolicy, ReminderTriggerConfig, ReminderRecipientConfig } from '../entities/organization-reminder-policy.entity';
import { ReminderSendHistory } from '../entities/reminder-send-history.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { NotificationService } from '../notification.service';

export interface CreateReminderPolicyDto {
  name: string;
  description?: string;
  trigger_config: ReminderTriggerConfig;
  recipient_config: ReminderRecipientConfig;
  message_template: string;
  cooldown_days?: number;
  is_enabled?: boolean;
}

export interface UpdateReminderPolicyDto {
  name?: string;
  description?: string;
  trigger_config?: Partial<ReminderTriggerConfig>;
  recipient_config?: Partial<ReminderRecipientConfig>;
  message_template?: string;
  cooldown_days?: number;
  is_enabled?: boolean;
}

@Injectable()
export class ReminderAutomationService {
  private readonly logger = new Logger(ReminderAutomationService.name);

  constructor(
    @InjectRepository(OrganizationReminderPolicy)
    private policyRepository: Repository<OrganizationReminderPolicy>,
    @InjectRepository(ReminderSendHistory)
    private sendHistoryRepository: Repository<ReminderSendHistory>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Create a new reminder policy for an organization.
   */
  async createPolicy(
    organizationId: string,
    dto: CreateReminderPolicyDto,
  ): Promise<OrganizationReminderPolicy> {
    if (!dto.name?.trim()) {
      throw new BadRequestException('Policy name is required');
    }

    this.validateTriggerConfig(dto.trigger_config);
    this.validateRecipientConfig(dto.recipient_config);

    if (!dto.message_template?.trim()) {
      throw new BadRequestException('Message template is required');
    }

    const policy = this.policyRepository.create({
      organization_id: organizationId,
      name: dto.name.trim(),
      description: dto.description?.trim() || null,
      trigger_config: dto.trigger_config,
      recipient_config: dto.recipient_config,
      message_template: dto.message_template.trim(),
      cooldown_days: dto.cooldown_days ?? 7,
      is_enabled: dto.is_enabled ?? true,
    });

    return this.policyRepository.save(policy);
  }

  /**
   * Update an existing reminder policy.
   */
  async updatePolicy(
    organizationId: string,
    policyId: string,
    dto: UpdateReminderPolicyDto,
  ): Promise<OrganizationReminderPolicy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, organization_id: organizationId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    if (dto.name !== undefined) {
      if (!dto.name?.trim()) {
        throw new BadRequestException('Policy name cannot be empty');
      }
      policy.name = dto.name.trim();
    }

    if (dto.description !== undefined) {
      policy.description = dto.description?.trim() || null;
    }

    if (dto.trigger_config) {
      this.validateTriggerConfig({ ...policy.trigger_config, ...dto.trigger_config });
      policy.trigger_config = { ...policy.trigger_config, ...dto.trigger_config };
    }

    if (dto.recipient_config) {
      this.validateRecipientConfig({ ...policy.recipient_config, ...dto.recipient_config });
      policy.recipient_config = { ...policy.recipient_config, ...dto.recipient_config };
    }

    if (dto.message_template !== undefined) {
      if (!dto.message_template?.trim()) {
        throw new BadRequestException('Message template cannot be empty');
      }
      policy.message_template = dto.message_template.trim();
    }

    if (dto.cooldown_days !== undefined) {
      if (dto.cooldown_days < 0) {
        throw new BadRequestException('Cooldown days must be non-negative');
      }
      policy.cooldown_days = dto.cooldown_days;
    }

    if (dto.is_enabled !== undefined) {
      policy.is_enabled = dto.is_enabled;
    }

    return this.policyRepository.save(policy);
  }

  /**
   * Delete a reminder policy.
   */
  async deletePolicy(organizationId: string, policyId: string): Promise<void> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, organization_id: organizationId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    await this.policyRepository.delete(policyId);
  }

  /**
   * Get a specific policy.
   */
  async getPolicy(organizationId: string, policyId: string): Promise<OrganizationReminderPolicy> {
    const policy = await this.policyRepository.findOne({
      where: { id: policyId, organization_id: organizationId },
    });

    if (!policy) {
      throw new NotFoundException('Policy not found');
    }

    return policy;
  }

  /**
   * List all policies for an organization.
   */
  async listPolicies(organizationId: string): Promise<OrganizationReminderPolicy[]> {
    return this.policyRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Execute all enabled reminder policies for an organization.
   * This is called by a scheduled job (e.g., every hour).
   */
  async executeRemindersForOrganization(organizationId: string): Promise<{ sent: number; failed: number }> {
    const org = await this.organizationRepository.findOne({ where: { id: organizationId } });
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const policies = await this.policyRepository.find({
      where: { organization_id: organizationId, is_enabled: true },
    });

    let sentCount = 0;
    let failedCount = 0;

    for (const policy of policies) {
      try {
        const result = await this.executePolicy(org, policy);
        sentCount += result.sent;
        failedCount += result.failed;
      } catch (error) {
        this.logger.error(
          `Error executing reminder policy ${policy.id} for org ${organizationId}`,
          error,
        );
        failedCount++;
      }
    }

    return { sent: sentCount, failed: failedCount };
  }

  /**
   * Execute a single reminder policy.
   * Finds all eligible contacts and sends reminders to those who don't have a recent send.
   */
  private async executePolicy(
    org: Organization,
    policy: OrganizationReminderPolicy,
  ): Promise<{ sent: number; failed: number }> {
    const recipients = await this.getEligibleRecipients(org.id, policy);
    let sentCount = 0;
    let failedCount = 0;

    for (const { contact, balance_due, days_overdue } of recipients) {
      // Check cooldown
      const lastSend = await this.sendHistoryRepository.findOne({
        where: {
          policy_id: policy.id,
          contact_id: contact.id,
        },
        order: { sent_at: 'DESC' },
      });

      if (lastSend) {
        const daysSinceLastSend = Math.floor(
          (Date.now() - lastSend.sent_at.getTime()) / (1000 * 60 * 60 * 24),
        );
        if (daysSinceLastSend < policy.cooldown_days) {
          this.logger.debug(
            `Skipping contact ${contact.id}: cooldown active (${daysSinceLastSend} < ${policy.cooldown_days} days)`,
          );
          continue;
        }
      }

      const balanceInfo = { balance_due, days_overdue };

      // Send reminder
      try {
        const message = this.fillMessageTemplate(policy.message_template, contact, balanceInfo);
        await this.notificationService.sendReminder(
          [contact.email!],
          message,
          undefined,
          { organizationId: org.id },
        );

        // Record successful send
        await this.sendHistoryRepository.save(
          this.sendHistoryRepository.create({
            policy_id: policy.id,
            organization_id: org.id,
            contact_id: contact.id,
            recipient_email: contact.email!,
            message_sent: message,
            balance_due_at_send: balanceInfo.balance_due,
            days_overdue_at_send: balanceInfo.days_overdue,
            send_status: 'sent',
          }),
        );

        sentCount++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(
          `Failed to send reminder to contact ${contact.id}: ${errorMessage}`,
        );

        // Record failed send
        await this.sendHistoryRepository.save(
          this.sendHistoryRepository.create({
            policy_id: policy.id,
            organization_id: org.id,
            contact_id: contact.id,
            recipient_email: contact.email!,
            message_sent: policy.message_template,
            send_status: 'failed',
            error_message: errorMessage,
          }),
        );

        failedCount++;
      }
    }

    // Update last_executed_at
    await this.policyRepository.update(
      { id: policy.id },
      { last_executed_at: new Date() },
    );

    return { sent: sentCount, failed: failedCount };
  }

  /**
   * Get the contacts eligible for a reminder policy, together with the balance
   * figures used for the trigger thresholds and the message placeholders.
   *
   * Eligibility is the conjunction of three conditions:
   *   1. Recipient config  — the contact is in scope for the policy audience.
   *   2. Balance trigger  — outstanding balance >= trigger_config.balance_due_threshold.
   *   3. Overdue trigger  — days overdue >= trigger_config.days_overdue_threshold.
   *
   * The whole set is computed with a single aggregate query (one row per contact)
   * rather than one query per contact, so a policy that covers a large audience
   * does not fan out into hundreds of round-trips.
   */
  private async getEligibleRecipients(
    organizationId: string,
    policy: OrganizationReminderPolicy,
  ): Promise<Array<{ contact: Contact; balance_due: number; days_overdue: number }>> {
    const { type, group_ids } = policy.recipient_config ?? { type: 'all_with_balance_due' };
    const balanceThreshold = Number(policy.trigger_config?.balance_due_threshold ?? 0) || 0;
    const daysThreshold = Number(policy.trigger_config?.days_overdue_threshold ?? 0) || 0;

    let query = this.paymentRepository
      .createQueryBuilder('payment')
      .innerJoin('payment.submission', 'submission')
      .innerJoin('submission.contact', 'contact')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('payment.status IN (:...statuses)', { statuses: ['PENDING', 'PARTIAL'] })
      .andWhere('contact.is_active = true')
      .andWhere('contact.email IS NOT NULL')
      .select('contact.id', 'contact_id')
      .addSelect('SUM(payment.balance_due)', 'balance_due')
      .addSelect('MIN(payment.created_at)', 'oldest_created_at')
      .groupBy('contact.id');

    if (type === 'specific_groups' && group_ids && group_ids.length > 0) {
      query = query
        .innerJoin('contact.groups', 'group')
        .andWhere('group.id IN (:...groupIds)', { groupIds: group_ids });
    }

    const rows = await query.getRawMany<{
      contact_id: string;
      balance_due: string;
      oldest_created_at: Date;
    }>();

    if (!rows.length) {
      return [];
    }

    const contacts = await this.contactRepository.find({
      where: { id: In(rows.map((row) => row.contact_id)) },
    });
    const contactById = new Map(contacts.map((contact) => [contact.id, contact]));

    const now = Date.now();
    const recipients: Array<{ contact: Contact; balance_due: number; days_overdue: number }> = [];

    for (const row of rows) {
      const contact = contactById.get(row.contact_id);
      if (!contact?.email) {
        continue;
      }

      const balanceDue = Number(row.balance_due) || 0;
      if (balanceDue <= 0 || balanceDue < balanceThreshold) {
        continue;
      }

      const oldestCreatedAt = new Date(row.oldest_created_at).getTime();
      if (Number.isNaN(oldestCreatedAt)) {
        continue;
      }

      const daysOverdue = Math.floor((now - oldestCreatedAt) / (1000 * 60 * 60 * 24));
      if (daysOverdue < daysThreshold) {
        continue;
      }

      recipients.push({
        contact,
        balance_due: balanceDue,
        days_overdue: daysOverdue,
      });
    }

    return recipients;
  }

  /**
   * Fill message template with contact and balance information.
   */
  private fillMessageTemplate(
    template: string,
    contact: Contact,
    balanceInfo: { balance_due: number; days_overdue: number },
  ): string {
    let message = template;

    const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(' ') || 'Valued Customer';

    message = message.replace(/\{\{contact_first_name\}\}/g, contact.first_name || '');
    message = message.replace(/\{\{contact_full_name\}\}/g, fullName);
    message = message.replace(/\{\{balance_due\}\}/g, balanceInfo.balance_due.toFixed(2));
    message = message.replace(/\{\{days_overdue\}\}/g, String(balanceInfo.days_overdue));

    return message;
  }

  /**
   * Get send history for a contact.
   */
  async getContactReminderHistory(
    organizationId: string,
    contactId: string,
    limit: number = 20,
  ): Promise<ReminderSendHistory[]> {
    return this.sendHistoryRepository.find({
      where: { organization_id: organizationId, contact_id: contactId },
      order: { sent_at: 'DESC' },
      take: limit,
    });
  }

  /**
   * Validate trigger configuration.
   */
  private validateTriggerConfig(config: Partial<ReminderTriggerConfig>): void {
    if (config.balance_due_threshold !== undefined) {
      if (config.balance_due_threshold < 0) {
        throw new BadRequestException('Balance due threshold must be non-negative');
      }
    }

    if (config.days_overdue_threshold !== undefined) {
      if (config.days_overdue_threshold < 0) {
        throw new BadRequestException('Days overdue threshold must be non-negative');
      }
    }
  }

  /**
   * Validate recipient configuration.
   */
  private validateRecipientConfig(config: Partial<ReminderRecipientConfig>): void {
    if (config.type !== undefined) {
      if (!['all_with_balance_due', 'specific_groups'].includes(config.type)) {
        throw new BadRequestException(
          'Invalid recipient type. Must be "all_with_balance_due" or "specific_groups"',
        );
      }

      if (config.type === 'specific_groups' && (!config.group_ids || config.group_ids.length === 0)) {
        throw new BadRequestException('Must specify at least one group for "specific_groups" type');
      }
    }
  }
}
