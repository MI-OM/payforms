import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlatformEntitlementsService } from './platform-entitlements.service';
import { OrganizationEntitlementsService } from '../organization/organization-entitlements.service';
import { BillingService } from '../billing/billing.service';

describe('PlatformEntitlementsService', () => {
  let service: PlatformEntitlementsService;
  let organizationRepository: any;
  let entitlements: OrganizationEntitlementsService;
  let billing: any;

  const orgRow = (tier = 'free') => ({ id: 'org-1', name: 'Greenfield', billing_plan_tier: tier });

  const plan = (tier = 'free') => ({
    id: `plan_${tier}`,
    name: tier,
    tier,
    monthly_cost_cents: 0,
    soft_limits: { forms: 5, contacts: 500, staff_users: 1, monthly_submissions: 1000, monthly_email_sends: 100, storage_gb: 1 },
    hard_limits: { forms: 10, contacts: 1000, staff_users: 2, monthly_submissions: 2000, monthly_email_sends: 200, storage_gb: 2 },
  });

  beforeEach(() => {
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue(orgRow()),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const overrideRepository: any = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((input: any) => input),
      save: jest.fn((input: any) => Promise.resolve({ id: 'ovr-1', organization_id: 'org-1', ...input })),
      remove: jest.fn(() => Promise.resolve()),
    };
    entitlements = new OrganizationEntitlementsService(overrideRepository);
    billing = {
      getPlanLimits: jest.fn((tier: string | null | undefined) => {
        const resolved = tier || 'free';
        return ['free', 'starter', 'professional', 'business', 'enterprise'].includes(resolved) ? plan(resolved) : null;
      }),
      listCatalog: jest.fn(() => ['free', 'starter', 'professional', 'business', 'enterprise'].map((tier) => plan(tier))),
    };
    service = new PlatformEntitlementsService(organizationRepository, entitlements, billing);
  });

  describe('listPlans', () => {
    it('returns the billing catalog', () => {
      expect(service.listPlans()).toHaveLength(5);
      expect(billing.listCatalog).toHaveBeenCalled();
    });
  });

  describe('view', () => {
    it('returns plan defaults with no overrides', async () => {
      const result = await service.view('org-1');
      expect(result.plan).toBe('free');
      expect(result.overrides).toBeNull();
      expect(result.effective.soft_limits.contacts).toBe(500);
    });

    it('merges negotiated overrides into the effective limits', async () => {
      (entitlements as any).overrideRepository.findOne.mockResolvedValue({
        organization_id: 'org-1',
        contacts_limit: 2000,
        forms_limit: null,
        staff_users_limit: null,
        monthly_submissions_limit: null,
        monthly_email_sends_limit: null,
        storage_gb_limit: 50,
        notes: 'annual deal',
        set_by_email: 'ops@payforms.com.ng',
        updated_at: new Date(),
      });

      const result = await service.view('org-1');
      expect(result.overrides).toMatchObject({ contacts_limit: 2000, storage_gb_limit: 50, notes: 'annual deal' });
      expect(result.effective.soft_limits.contacts).toBe(2000);
      expect(result.effective.hard_limits.contacts).toBe(2000);
      expect(result.effective.soft_limits.storage_gb).toBe(50);
      expect(result.effective.soft_limits.forms).toBe(5);
      expect(result.set_by_email).toBe('ops@payforms.com.ng');
    });

    it('throws NotFound for an unknown organization', async () => {
      organizationRepository.findOne.mockResolvedValue(null);
      await expect(service.view('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('set', () => {
    it('persists limits with the actor recorded', async () => {
      const result = await service.set('org-1', { contacts_limit: 2000, notes: 'deal' }, { id: 'admin-1', email: 'ops@payforms.com.ng' });
      expect(result.plan_changed).toBe(false);
      expect(result.overrides).toMatchObject({ contacts_limit: 2000, notes: 'deal' });
      expect(result.effective.hard_limits.contacts).toBe(2000);
      expect(result.set_by_email).toBe('ops@payforms.com.ng');
    });

    it('changes the billing tier in the same action when provided', async () => {
      const result = await service.set('org-1', { plan: 'business', contacts_limit: 10000 }, { id: 'admin-1', email: 'ops@x.com' });
      expect(organizationRepository.update).toHaveBeenCalledWith('org-1', { billing_plan_tier: 'business' });
      expect(result.plan).toBe('business');
      expect(result.plan_changed).toBe(true);
      expect(result.effective.soft_limits.contacts).toBe(10000);
    });

    it('rejects an unknown plan tier', async () => {
      await expect(service.set('org-1', { plan: 'platinum' as any }, { id: null, email: null })).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty change', async () => {
      await expect(service.set('org-1', {}, { id: null, email: null })).rejects.toThrow('Nothing to change');
    });
  });

  describe('clear', () => {
    it('removes overrides and returns plan defaults', async () => {
      (entitlements as any).overrideRepository.findOne.mockResolvedValue({
        organization_id: 'org-1',
        contacts_limit: 2000,
      });
      const result = await service.clear('org-1');
      expect(result.cleared).toBe(true);
      expect(result.effective.soft_limits.contacts).toBe(500);
    });

    it('throws when there is nothing to clear', async () => {
      await expect(service.clear('org-1')).rejects.toThrow(NotFoundException);
    });
  });
});
