import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DunningCampaign } from '../entities/dunning-campaign.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { MarketReadinessService } from '../market-readiness.service';

/**
 * DunningSchedulerService
 *
 * Runs three cron jobs that fire daily, weekly, and monthly.
 * Each job finds all organizations that have the arrears_dunning_enabled
 * feature flag set, then iterates every ACTIVE campaign whose
 * execution_frequency matches, and calls runDunningCampaign().
 *
 * This is the piece that makes DAILY / WEEKLY / MONTHLY campaigns
 * actually execute automatically rather than requiring a manual API call.
 *
 * Cron schedule:
 *   - DAILY   → 02:00 every day
 *   - WEEKLY  → 02:30 every Monday
 *   - MONTHLY → 03:00 on the 1st of every month
 *
 * Design decisions:
 *   - Staggered start times prevent all three jobs from hammering the DB
 *     at exactly the same moment.
 *   - Each job is independent: a failure in the DAILY job does not prevent
 *     the WEEKLY job from running.
 *   - Per-campaign errors are caught and logged but do not abort the loop,
 *     so one broken campaign does not block the rest.
 *   - We only run campaigns whose status is 'ACTIVE'. DRAFT / PAUSED /
 *     COMPLETED / ARCHIVED campaigns are skipped.
 *   - We guard against running the same campaign twice within its period
 *     using last_executed_at: a DAILY campaign is skipped if it was already
 *     run within the past 23 hours, a WEEKLY within 6 days, etc.
 */
@Injectable()
export class DunningSchedulerService {
  private readonly logger = new Logger(DunningSchedulerService.name);

  constructor(
    @InjectRepository(DunningCampaign)
    private readonly campaignRepository: Repository<DunningCampaign>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly marketReadinessService: MarketReadinessService,
  ) {}

  // ─── Daily: every day at 02:00 ────────────────────────────────────────────

  @Cron('0 2 * * *', { name: 'dunning-daily' })
  async runDailyCampaigns(): Promise<void> {
    this.logger.log('Dunning scheduler: running DAILY campaigns');
    await this.executeCampaignsByFrequency('DAILY', 23 * 60 * 60 * 1000); // 23 h guard
  }

  // ─── Weekly: every Monday at 02:30 ────────────────────────────────────────

  @Cron('30 2 * * 1', { name: 'dunning-weekly' })
  async runWeeklyCampaigns(): Promise<void> {
    this.logger.log('Dunning scheduler: running WEEKLY campaigns');
    await this.executeCampaignsByFrequency('WEEKLY', 6 * 24 * 60 * 60 * 1000); // 6 days guard
  }

  // ─── Monthly: 1st of every month at 03:00 ─────────────────────────────────

  @Cron('0 3 1 * *', { name: 'dunning-monthly' })
  async runMonthlyCampaigns(): Promise<void> {
    this.logger.log('Dunning scheduler: running MONTHLY campaigns');
    await this.executeCampaignsByFrequency('MONTHLY', 28 * 24 * 60 * 60 * 1000); // 28 days guard
  }

  // ─── Core execution logic ─────────────────────────────────────────────────

  private async executeCampaignsByFrequency(
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    minIntervalMs: number,
  ): Promise<void> {
    // Step 1: Find all organizations that have the dunning flag enabled.
    // We use a raw query against the JSONB column for efficiency — we don't
    // want to load every org into memory just to check the flag.
    let organizations: Organization[];
    try {
      organizations = await this.organizationRepository
        .createQueryBuilder('org')
        .where(`org.market_readiness_flags->>'arrears_dunning_enabled' = 'true'`)
        .select(['org.id'])
        .getMany();
    } catch (err) {
      this.logger.error('Dunning scheduler: failed to query enabled organizations', err);
      return;
    }

    if (!organizations.length) {
      this.logger.debug(`Dunning scheduler: no organizations with arrears_dunning_enabled for ${frequency}`);
      return;
    }

    this.logger.log(
      `Dunning scheduler: found ${organizations.length} org(s) with dunning enabled for ${frequency}`,
    );

    const now = Date.now();

    // Step 2: For each org, find ACTIVE campaigns matching this frequency.
    for (const org of organizations) {
      let campaigns: DunningCampaign[];
      try {
        campaigns = await this.campaignRepository.find({
          where: {
            organization_id: org.id,
            status: 'ACTIVE',
            execution_frequency: frequency,
          },
          select: ['id', 'name', 'last_executed_at', 'organization_id'],
        });
      } catch (err) {
        this.logger.error(
          `Dunning scheduler: failed to query campaigns for org ${org.id}`,
          err,
        );
        continue;
      }

      for (const campaign of campaigns) {
        // Step 3: Guard — skip if already run within the minimum interval.
        if (campaign.last_executed_at) {
          const msSinceLast = now - new Date(campaign.last_executed_at).getTime();
          if (msSinceLast < minIntervalMs) {
            this.logger.debug(
              `Dunning scheduler: skipping campaign ${campaign.id} ("${campaign.name}") — ` +
              `last run ${Math.round(msSinceLast / 60000)} min ago, interval is ${Math.round(minIntervalMs / 60000)} min`,
            );
            continue;
          }
        }

        // Step 4: Execute.
        try {
          this.logger.log(
            `Dunning scheduler: executing campaign ${campaign.id} ("${campaign.name}") for org ${org.id}`,
          );
          await this.marketReadinessService.runDunningCampaign(org.id, campaign.id, {
            dry_run: false,
          });
          this.logger.log(
            `Dunning scheduler: campaign ${campaign.id} completed successfully`,
          );
        } catch (err) {
          // Log but continue — one bad campaign should not block others.
          this.logger.error(
            `Dunning scheduler: campaign ${campaign.id} failed`,
            err instanceof Error ? err.message : err,
          );
        }
      }
    }
  }
}
