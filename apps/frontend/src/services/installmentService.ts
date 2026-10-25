import { apiClient } from './api';

// ─── Types ─────────────────────────────────────────────────────────────────

export interface InstallmentPlanItem {
  id: string;
  plan_id: string;
  label: string;
  amount: number;
  due_date: string; // ISO date e.g. "2025-03-15"
  penalty_rule: Record<string, unknown> | null;
  order_index: number;
}

export interface InstallmentPlan {
  id: string;
  organization_id: string;
  form_id: string;
  name: string;
  currency: string;
  total_amount: number;
  active: boolean;
  created_at: string;
  items?: InstallmentPlanItem[]; // present on get/create, absent on list
}

export interface ContactInstallmentAccount {
  id: string;
  organization_id: string;
  contact_id: string;
  plan_id: string;
  outstanding_amount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'OVERDUE';
  created_at: string;
  updated_at: string;
}

export interface DunningCampaign {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  status: 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ARCHIVED';
  min_days_overdue: number;
  max_days_overdue: number;
  min_outstanding_amount: string;
  escalation_rules: Record<string, any>;
  filter_criteria: Record<string, any>;
  execution_frequency: 'MANUAL' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  total_runs: number;
  total_outstanding_snapshot: string | null;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DunningRun {
  id: string;
  campaign_id: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  contacts_evaluated: number;
  contacts_escalated: number;
  notifications_sent: number;
  total_outstanding: string;
  summary: Record<string, any>;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ArrearsSnapshot {
  id: string;
  run_id: string;
  contact_id: string;
  outstanding_amount: string;
  days_overdue: number;
  current_stage: number;
  status: string;
  delinquency_start_date: string | null;
  metadata: Record<string, any>;
  captured_at: string;
  contact?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}

export interface MarketFlags {
  installments_enabled: boolean;
  arrears_dunning_enabled: boolean;
  [key: string]: boolean;
}

export interface InstallmentPlanItemInput {
  label: string;
  amount: number;
  due_date: string;
  penalty_rule?: Record<string, unknown>;
  order_index?: number;
}

export interface CreatePlanDto {
  form_id: string;
  name: string;
  currency?: string;
  total_amount: number;
  active?: boolean;
  items: InstallmentPlanItemInput[];
}

export interface UpdatePlanDto {
  name?: string;
  currency?: string;
  total_amount?: number;
  active?: boolean;
  items?: InstallmentPlanItemInput[];
}

export interface CreateCampaignDto {
  name: string;
  description?: string;
  status?: DunningCampaign['status'];
  min_days_overdue?: number;
  max_days_overdue?: number;
  min_outstanding_amount?: string;
  escalation_rules?: Record<string, any>;
  filter_criteria?: Record<string, any>;
  execution_frequency?: DunningCampaign['execution_frequency'];
}

// ─── Service ────────────────────────────────────────────────────────────────

class InstallmentService {
  // Feature flags
  async getFlags(): Promise<MarketFlags> {
    return apiClient.get('/v1/market/features');
  }

  async enableInstallments(): Promise<MarketFlags> {
    return apiClient.patch('/v1/market/features', {
      flags: { installments_enabled: true },
    });
  }

  async enableDunning(): Promise<MarketFlags> {
    return apiClient.patch('/v1/market/features', {
      flags: { arrears_dunning_enabled: true },
    });
  }

  // Installment Plans
  async listPlans(): Promise<InstallmentPlan[]> {
    return apiClient.get('/v1/market/installments/plans');
  }

  async getPlan(planId: string): Promise<InstallmentPlan> {
    return apiClient.get(`/v1/market/installments/plans/${planId}`);
  }

  async createPlan(dto: CreatePlanDto): Promise<InstallmentPlan> {
    return apiClient.post('/v1/market/installments/plans', dto);
  }

  async updatePlan(planId: string, dto: UpdatePlanDto): Promise<InstallmentPlan> {
    return apiClient.patch(`/v1/market/installments/plans/${planId}`, dto);
  }

  async assignContacts(
    planId: string,
    contactIds: string[],
  ): Promise<{ success: boolean; requested: number; valid_contacts: number; assigned: number; skipped_existing: number }> {
    return apiClient.post(`/v1/market/installments/plans/${planId}/assign-contacts`, {
      contact_ids: contactIds,
    });
  }

  async listAccounts(planId?: string): Promise<ContactInstallmentAccount[]> {
    const params = planId ? { plan_id: planId } : undefined;
    return apiClient.get('/v1/market/installments/accounts', params);
  }

  // Dunning Campaigns
  async listCampaigns(): Promise<DunningCampaign[]> {
    return apiClient.get('/v1/market/campaigns');
  }

  async getCampaign(campaignId: string): Promise<DunningCampaign> {
    return apiClient.get(`/v1/market/campaigns/${campaignId}`);
  }

  async createCampaign(dto: CreateCampaignDto): Promise<DunningCampaign> {
    return apiClient.post('/v1/market/campaigns', dto);
  }

  async updateCampaign(campaignId: string, dto: Partial<CreateCampaignDto>): Promise<DunningCampaign> {
    return apiClient.patch(`/v1/market/campaigns/${campaignId}`, dto);
  }

  async runCampaign(
    campaignId: string,
    opts: { dry_run?: boolean; scheduled_for?: string } = {},
  ): Promise<DunningRun> {
    return apiClient.post(`/v1/market/campaigns/${campaignId}/run`, opts);
  }

  async listRuns(campaignId: string): Promise<DunningRun[]> {
    return apiClient.get(`/v1/market/campaigns/${campaignId}/runs`);
  }

  async listSnapshots(runId: string): Promise<ArrearsSnapshot[]> {
    return apiClient.get(`/v1/market/runs/${runId}/snapshots`);
  }
}

export const installmentService = new InstallmentService();
