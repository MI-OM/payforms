import { OrganizationEntitlementsService } from './organization-entitlements.service';
import { OrganizationEntitlementOverride } from './entities/organization-entitlement-override.entity';

describe('OrganizationEntitlementsService', () => {
  let service: OrganizationEntitlementsService;
  let repository: any;

  const planLimits = () => ({
    soft_limits: {
      forms: 5,
      contacts: 500,
      staff_users: 1,
      monthly_submissions: 1000,
      monthly_email_sends: 100,
      storage_gb: 1,
    },
    hard_limits: {
      forms: 10,
      contacts: 1000,
      staff_users: 2,
      monthly_submissions: 2000,
      monthly_email_sends: 200,
      storage_gb: 2,
    },
  });

  const overrideRow = (partial: Partial<OrganizationEntitlementOverride> = {}) =>
    ({
      id: 'ovr-1',
      organization_id: 'org-1',
      contacts_limit: null,
      forms_limit: null,
      staff_users_limit: null,
      monthly_submissions_limit: null,
      monthly_email_sends_limit: null,
      storage_gb_limit: null,
      notes: null,
      set_by_platform_user_id: null,
      set_by_email: null,
      created_at: new Date(),
      updated_at: new Date(),
      ...partial,
    }) as OrganizationEntitlementOverride;

  beforeEach(() => {
    repository = {
      findOne: jest.fn(),
      create: jest.fn((input: any) => ({ ...input })),
      save: jest.fn((input: any) => Promise.resolve({ id: 'ovr-1', ...input })),
      remove: jest.fn(() => Promise.resolve()),
    };
    service = new OrganizationEntitlementsService(repository);
  });

  describe('mergePlanWithOverrides', () => {
    it('returns the plan unchanged when there is no override', () => {
      const plan = planLimits();
      const merged = service.mergePlanWithOverrides(plan, null);
      expect(merged).toBe(plan);
    });

    it('replaces BOTH soft and hard limits for overridden metrics only', () => {
      const plan = planLimits();
      const merged = service.mergePlanWithOverrides(plan, overrideRow({ contacts_limit: 2000, storage_gb_limit: 50 }));

      expect(merged.soft_limits.contacts).toBe(2000);
      expect(merged.hard_limits.contacts).toBe(2000);
      expect(merged.soft_limits.storage_gb).toBe(50);
      expect(merged.hard_limits.storage_gb).toBe(50);

      // Non-overridden metrics keep the plan defaults.
      expect(merged.soft_limits.forms).toBe(5);
      expect(merged.hard_limits.monthly_email_sends).toBe(200);
      expect(merged.soft_limits.staff_users).toBe(1);
    });

    it('never mutates the input plan', () => {
      const plan = planLimits();
      service.mergePlanWithOverrides(plan, overrideRow({ contacts_limit: 42 }));
      expect(plan.soft_limits.contacts).toBe(500);
      expect(plan.hard_limits.contacts).toBe(1000);
    });
  });

  describe('upsert', () => {
    it('creates a row and sets only the provided metrics, recording the actor', async () => {
      repository.findOne.mockResolvedValue(null);

      const saved = await service.upsert(
        'org-1',
        { contacts_limit: 2000, notes: 'annual deal' },
        { id: 'admin-1', email: 'ops@payforms.com.ng' },
      );

      expect(repository.create).toHaveBeenCalledWith({ organization_id: 'org-1' });
      expect(saved.contacts_limit).toBe(2000);
      expect(saved.forms_limit).toBeUndefined();
      expect(saved.notes).toBe('annual deal');
      expect(saved.set_by_email).toBe('ops@payforms.com.ng');
      expect(saved.set_by_platform_user_id).toBe('admin-1');
      expect(repository.save).toHaveBeenCalled();
    });

    it('clears a metric when the value is explicitly null', async () => {
      repository.findOne.mockResolvedValue(overrideRow({ contacts_limit: 2000 }));

      const saved = await service.upsert('org-1', { contacts_limit: null }, null);

      expect(saved.contacts_limit).toBeNull();
      expect(repository.save).toHaveBeenCalled();
    });
  });

  describe('clear', () => {
    it('removes the row and reports true', async () => {
      repository.findOne.mockResolvedValue(overrideRow());
      await expect(service.clear('org-1')).resolves.toBe(true);
      expect(repository.remove).toHaveBeenCalled();
    });

    it('reports false when there is nothing to clear', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.clear('org-1')).resolves.toBe(false);
    });
  });
});
