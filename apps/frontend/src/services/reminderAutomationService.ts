import { apiClient } from './api';

/**
 * Trigger configuration for automated reminders
 */
export interface ReminderTriggerConfig {
  balance_due_threshold: number;
  days_overdue_threshold: number;
}

/**
 * Recipient configuration for automated reminders
 */
export interface ReminderRecipientConfig {
  type: 'all_with_balance_due' | 'specific_groups';
  group_ids?: string[];
}

/**
 * Reminder automation policy
 */
export interface ReminderPolicy {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  is_enabled: boolean;
  trigger_config: ReminderTriggerConfig;
  recipient_config: ReminderRecipientConfig;
  message_template: string;
  cooldown_days: number;
  last_executed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Reminder send history record
 */
export interface ReminderSendHistory {
  id: string;
  policy_id: string;
  organization_id: string;
  contact_id: string;
  recipient_email: string;
  message_sent: string;
  balance_due_at_send?: number;
  days_overdue_at_send?: number;
  send_status: 'sent' | 'failed' | 'bounced';
  error_message?: string;
  sent_at: string;
}

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

class ReminderAutomationService {
  /**
   * Create a new reminder policy
   */
  async createPolicy(dto: CreateReminderPolicyDto): Promise<ReminderPolicy> {
    return apiClient.post('/reminders/policies', dto);
  }

  /**
   * List all reminder policies
   */
  async listPolicies(): Promise<ReminderPolicy[]> {
    return apiClient.get('/reminders/policies');
  }

  /**
   * Get a specific reminder policy
   */
  async getPolicy(policyId: string): Promise<ReminderPolicy> {
    return apiClient.get(`/reminders/policies/${policyId}`);
  }

  /**
   * Update a reminder policy
   */
  async updatePolicy(
    policyId: string,
    dto: UpdateReminderPolicyDto,
  ): Promise<ReminderPolicy> {
    return apiClient.patch(`/reminders/policies/${policyId}`, dto);
  }

  /**
   * Delete a reminder policy
   */
  async deletePolicy(policyId: string): Promise<void> {
    return apiClient.delete(`/reminders/policies/${policyId}`);
  }

  /**
   * Get reminder send history for a contact
   */
  async getContactHistory(
    contactId: string,
    limit: number = 20,
  ): Promise<ReminderSendHistory[]> {
    return apiClient.get(`/reminders/policies/history/${contactId}`, { limit });
  }

  /**
   * Run every enabled reminder policy immediately.
   *
   * The backend scheduler does this on a fixed cron. This is the on-demand
   * equivalent — useful right after creating a policy or when testing a
   * message template, without waiting for the next scheduled pass.
   */
  async runPoliciesNow(): Promise<{ sent: number; failed: number }> {
    return apiClient.post('/reminders/policies/run');
  }

  /**
   * Toggle a policy's enabled status
   */
  async togglePolicy(policyId: string, isEnabled: boolean): Promise<ReminderPolicy> {
    return this.updatePolicy(policyId, { is_enabled: isEnabled });
  }

  /**
   * Get message preview with placeholders filled in
   */
  getMessagePreview(
    template: string,
    contactName: string,
    balanceDue: number,
    daysOverdue: number,
  ): string {
    let preview = template;
    preview = preview.replace('{{contact_first_name}}', contactName.split(' ')[0] || 'Contact');
    preview = preview.replace('{{contact_full_name}}', contactName);
    preview = preview.replace('{{balance_due}}', balanceDue.toLocaleString());
    preview = preview.replace('{{days_overdue}}', daysOverdue.toString());
    return preview;
  }
}

export const reminderAutomationService = new ReminderAutomationService();
