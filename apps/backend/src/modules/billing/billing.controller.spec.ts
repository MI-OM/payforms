import { ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BillingController } from './billing.controller';

describe('BillingController', () => {
  const billingService = {
    getOrganizationPlan: jest.fn(),
    calculateUsage: jest.fn(),
    getUsageReport: jest.fn(),
    upgradePlan: jest.fn(),
  };

  let controller: BillingController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BillingController(billingService as any);
  });

  it('applies authentication and role guards at the controller level', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, BillingController) || [];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
  });

  it('restricts plan upgrades to admins', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, controller.upgradePlan);
    expect(roles).toEqual(['ADMIN']);
  });

  it('rejects unauthenticated callers', async () => {
    await expect(controller.getUsage({ user: undefined } as any, 'org-a')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(billingService.calculateUsage).not.toHaveBeenCalled();
  });

  it('rejects callers requesting another organization', async () => {
    await expect(
      controller.getPlan({ user: { organization_id: 'org-a' } } as any, 'org-b'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(billingService.getOrganizationPlan).not.toHaveBeenCalled();
  });

  it('scopes reads to the caller organization', async () => {
    billingService.getOrganizationPlan.mockResolvedValue({ tier: 'PRO' });

    const result = await controller.getPlan(
      { user: { organization_id: 'org-a' } } as any,
      'org-a',
    );

    expect(billingService.getOrganizationPlan).toHaveBeenCalledWith('org-a');
    expect(result).toEqual({ plan: { tier: 'PRO' } });
  });
});
