import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { OrganizationController } from './organization.controller';

describe('OrganizationController', () => {
  const organizationService = {
    findById: jest.fn(),
  };
  const organizationEntitlementsService = {
    getForOrganization: jest.fn(),
    mergePlanWithOverrides: jest.fn(),
  };
  const billingService = {
    getPlanLimits: jest.fn(),
  };

  const freePlan = {
    tier: 'free',
    name: 'Free',
    soft_limits: { contacts: 500, forms: 10, staff_users: 2, monthly_submissions: 1000, monthly_email_sends: 500, storage_gb: 5 },
    hard_limits: { contacts: 500, forms: 10, staff_users: 2, monthly_submissions: 1000, monthly_email_sends: 500, storage_gb: 5 },
  };

  const businessPlan = {
    tier: 'business',
    name: 'Business',
    soft_limits: { contacts: 50000, forms: 500, staff_users: 25, monthly_submissions: 1000000, monthly_email_sends: 500000, storage_gb: 500 },
    hard_limits: { contacts: 100000, forms: 1000, staff_users: 50, monthly_submissions: 2000000, monthly_email_sends: 1000000, storage_gb: 1000 },
  };

  let controller: OrganizationController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new OrganizationController(
      organizationService as any,
      organizationEntitlementsService as any,
      billingService as any,
    );
  });

  it('applies authentication and role guards at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, OrganizationController) || [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('allows both admins and staff to read entitlements', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.getEntitlements);
    expect(roles).toEqual(['ADMIN', 'STAFF']);
  });

  it('returns plan defaults when the organization has no overrides', async () => {
    organizationService.findById.mockResolvedValue({ id: 'org-a', billing_plan_tier: 'business' });
    billingService.getPlanLimits.mockReturnValue(businessPlan);
    organizationEntitlementsService.getForOrganization.mockResolvedValue(null);
    organizationEntitlementsService.mergePlanWithOverrides.mockReturnValue(businessPlan);

    const result = await controller.getEntitlements({ user: { organization_id: 'org-a' } } as any);

    expect(organizationEntitlementsService.getForOrganization).toHaveBeenCalledWith('org-a');
    expect(result).toMatchObject({
      organization_id: 'org-a',
      plan: 'business',
      plan_name: 'Business',
      overrides: null,
      effective: {
        soft_limits: businessPlan.soft_limits,
        hard_limits: businessPlan.hard_limits,
      },
    });
  });

  it('merges negotiated overrides into the effective limits', async () => {
    const override = { contacts_limit: 50, forms_limit: null, staff_users_limit: null, monthly_submissions_limit: null, monthly_email_sends_limit: null, storage_gb_limit: null, notes: 'Deal Oct 2026' };
    const merged = {
      ...businessPlan,
      soft_limits: { ...businessPlan.soft_limits, contacts: 50 },
      hard_limits: { ...businessPlan.hard_limits, contacts: 50 },
    };
    organizationService.findById.mockResolvedValue({ id: 'org-a', billing_plan_tier: 'business' });
    billingService.getPlanLimits.mockReturnValue(businessPlan);
    organizationEntitlementsService.getForOrganization.mockResolvedValue(override);
    organizationEntitlementsService.mergePlanWithOverrides.mockReturnValue(merged);

    const result = await controller.getEntitlements({ user: { organization_id: 'org-a' } } as any);

    expect(organizationEntitlementsService.mergePlanWithOverrides).toHaveBeenCalledWith(businessPlan, override);
    expect(result.overrides).toEqual(override);
    // The merged plan (override replacing the contacts soft+hard limits)
    // must be passed through untouched.
    expect(result.effective.soft_limits).toBe(merged.soft_limits);
    expect(result.effective.hard_limits).toBe(merged.hard_limits);
  });

  it('falls back to the free plan for an unknown billing tier', async () => {
    organizationService.findById.mockResolvedValue({ id: 'org-a', billing_plan_tier: 'nonsense-tier' });
    billingService.getPlanLimits.mockImplementation((tier: string) => (tier === 'free' ? freePlan : null));

    const result = await controller.getEntitlements({ user: { organization_id: 'org-a' } } as any);

    expect(result).toMatchObject({
      plan: 'free',
      plan_name: 'Free',
      overrides: null,
      effective: {
        soft_limits: freePlan.soft_limits,
        hard_limits: freePlan.hard_limits,
      },
    });
    expect(organizationEntitlementsService.getForOrganization).not.toHaveBeenCalled();
  });
});
