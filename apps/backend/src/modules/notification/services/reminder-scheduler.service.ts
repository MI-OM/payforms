import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationReminderPolicy } from '../entities/organization-reminder-policy.entity';
import { ReminderAutomationService } from './reminder-automation.service';

/**
 * Cron expression used by the reminder scheduler.
 *
 * Defaults to hourly (at the top of the hour). Reminder policies carry their own
 * `cooldown_days`, so running more often than hourly does not produce more email
 * — the cooldown is what governs send frequency, not the scheduler tick.
 *
 * Override with REMINDER_CRON_EXPRESSION (standard 5- or 6-field cron syntax).
 */
const REMINDER_CRON_EXPRESSION =
  process.env.REMINDER_CRON_EXPRESSION?.trim() || '0 * * * *';

/**
 * ReminderSchedulerService
 *
 * This is the piece that makes automated reminder policies actually fire. Without
 * it, `ReminderAutomationService.executeRemindersForOrganization()` is only ever
 * reached by a manual API call and every policy is inert.
 *
 * Behaviour:
 *   - Finds every organization that has at least one ENABLED reminder policy.
 *   - Runs each of those organizations' enabled policies.
 *   - Never lets one organization's failure stop the others.
 *
 * Design decisions:
 *   - The job is scoped to organizations that actually have policies, so an
 *     installation with no reminder traffic does zero work per tick.
 *   - A re-entrancy guard prevents overlapping runs. Policy evaluation sends
 *     real email, so a second concurrent pass could double-send to contacts that
 *     were mid-flight when the cooldown check was performed.
 *   - Per-organization errors are caught and logged, never rethrown.
 */
@Injectable()
export class ReminderSchedulerService {
  private readonly logger = new Logger(ReminderSchedulerService.name);

  /** Guards against a slow pass overlapping the next tick. */
  private running = false;

  constructor(
    @InjectRepository(OrganizationReminderPolicy)
    private readonly policyRepository: Repository<OrganizationReminderPolicy>,
    private readonly reminderAutomationService: ReminderAutomationService,
  ) {}

  /**
   * Hourly tick. Evaluates every enabled policy in the installation.
   */
  @Cron(REMINDER_CRON_EXPRESSION, { name: 'reminder-hourly' })
  async runScheduledReminders(): Promise<void> {
    if (this.running) {
      this.logger.warn(
        'Reminder scheduler: previous run is still in progress, skipping this tick',
      );
      return;
    }

    this.running = true;
    try {
      await this.runAllOrganizations();
    } catch (error) {
      // Defensive: runAllOrganizations already isolates per-organization errors.
      this.logger.error(
        'Reminder scheduler: run failed',
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.running = false;
    }
  }

  /**
   * Run every enabled policy for a single organization.
   *
   * Exposed so the controller can offer an on-demand "run now" without the
   * scheduler having to own the org-scoped query.
   */
  async runForOrganization(
    organizationId: string,
  ): Promise<{ sent: number; failed: number }> {
    return this.reminderAutomationService.executeRemindersForOrganization(organizationId);
  }

  /**
   * Core loop: find organizations with enabled policies and run each one.
   */
  private async runAllOrganizations(): Promise<void> {
    let organizationIds: string[];

    try {
      const rows = await this.policyRepository
        .createQueryBuilder('policy')
        .select('DISTINCT policy.organization_id', 'organization_id')
        .where('policy.is_enabled = true')
        .getRawMany<{ organization_id: string }>();

      organizationIds = rows.map((row) => row.organization_id).filter(Boolean);
    } catch (error) {
      this.logger.error(
        'Reminder scheduler: failed to query organizations with enabled policies',
        error instanceof Error ? error.message : error,
      );
      return;
    }

    if (!organizationIds.length) {
      this.logger.debug('Reminder scheduler: no organizations have enabled reminder policies');
      return;
    }

    this.logger.log(
      `Reminder scheduler: running enabled policies for ${organizationIds.length} organization(s)`,
    );

    for (const organizationId of organizationIds) {
      try {
        const result = await this.runForOrganization(organizationId);
        if (result.sent || result.failed) {
          this.logger.log(
            `Reminder scheduler: org ${organizationId} — sent ${result.sent}, failed ${result.failed}`,
          );
        }
      } catch (error) {
        // One broken organization must not block the rest.
        this.logger.error(
          `Reminder scheduler: failed for organization ${organizationId}`,
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
}
