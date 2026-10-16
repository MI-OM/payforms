import { BillingService, BYTES_PER_GB, PlanLimitExceededException } from './billing.service';
import { OrganizationEntitlementsService } from '../organization/organization-entitlements.service';

/**
 * These tests pin the behaviour the platform actually depends on: plan limits
 * (including negotiated per-org overrides) must REJECT writes, not just be
 * reported. Before this existed, `enforceHardLimits` had no callers and every
 * limit was cosmetic.
 */
describe('BillingService limit enforcement', () => {
  const organizationRepository = { findOne: jest.fn() };
  const formRepository = { count: jest.fn() };
  const contactRepository = { count: jest.fn() };
  const userRepository = { count: jest.fn() };
  const submissionRepository = { createQueryBuilder: jest.fn() };
  const auditLogRepository = { create: jest.fn(), save: jest.fn() };
  const usageEventRepository = { createQueryBuilder: jest.fn() };
  const overrideRepository = { findOne: jest.fn() };

  const queryBuilder = (overrides: Record<string, unknown> = {}) => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    getCount: jest.fn().mockResolvedValue(0),
    getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    ...overrides,
  });

  const usageSum = (total: number | string) =>
    queryBuilder({ getRawOne: jest.fn().mockResolvedValue({ total: String(total) }) });

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();

    organizationRepository.findOne.mockResolvedValue({ id: 'org-1', billing_plan_tier: 'free' });
    formRepository.count.mockResolvedValue(0);
    contactRepository.count.mockResolvedValue(0);
    userRepository.count.mockResolvedValue(0);
    submissionRepository.createQueryBuilder.mockReturnValue(queryBuilder());
    usageEventRepository.createQueryBuilder.mockReturnValue(usageSum(0));
    auditLogRepository.create.mockImplementation((value: unknown) => value);
    auditLogRepository.save.mockResolvedValue({});
    overrideRepository.findOne.mockResolvedValue(null);

    service = new BillingService(
      organizationRepository as any,
      formRepository as any,
      contactRepository as any,
      userRepository as any,
      submissionRepository as any,
      auditLogRepository as any,
      usageEventRepository as any,
      new OrganizationEntitlementsService(overrideRepository as any),
    );
  });

  it('exposes every catalog tier including business', () => {
    const catalog = service.listCatalog();
    expect(catalog.map((plan) => plan.tier)).toEqual([
      'free',
      'starter',
      'professional',
      'business',
      'enterprise',
    ]);
  });

  it('rejects the write that would cross the forms hard limit', async () => {
    // Free plan hard limit is 10 forms; the org already has 10.
    formRepository.count.mockResolvedValue(10);

    await expect(service.assertWithinHardLimit('org-1', 'forms')).rejects.toBeInstanceOf(
      PlanLimitExceededException,
    );
  });

  it('allows the write that lands exactly on the limit', async () => {
    // 9 existing + 1 new === 10 === the hard limit, which is allowed.
    formRepository.count.mockResolvedValue(9);

    await expect(service.assertWithinHardLimit('org-1', 'forms')).resolves.toBeUndefined();
    expect(auditLogRepository.save).not.toHaveBeenCalled();
  });

  it('records an audit entry identifying the blocked resource', async () => {
    formRepository.count.mockResolvedValue(10);

    await expect(service.assertWithinHardLimit('org-1', 'forms')).rejects.toBeDefined();

    expect(auditLogRepository.save).toHaveBeenCalledTimes(1);
    const saved = auditLogRepository.save.mock.calls[0][0];
    expect(saved.action).toBe('BILLING_LIMIT_EXCEEDED');
    expect(saved.metadata).toMatchObject({ resource: 'forms', limit: 10, current_usage: 10, requested: 1 });
  });

  it('counts the whole batch for an import', async () => {
    contactRepository.count.mockResolvedValue(995);

    // 995 + 10 > 1000 (free hard limit) -> rejected as one unit.
    await expect(service.assertWithinHardLimit('org-1', 'contacts', 10)).rejects.toBeInstanceOf(
      PlanLimitExceededException,
    );
  });

  it('honours a negotiated entitlement override over the plan default', async () => {
    // A platform operator negotiated 3 forms on an otherwise free plan.
    overrideRepository.findOne.mockResolvedValue({
      organization_id: 'org-1',
      forms_limit: 3,
      contacts_limit: null,
      staff_users_limit: null,
      monthly_submissions_limit: null,
      monthly_email_sends_limit: null,
      storage_gb_limit: null,
      notes: null,
    });
    formRepository.count.mockResolvedValue(3);

    await expect(service.assertWithinHardLimit('org-1', 'forms')).rejects.toBeInstanceOf(
      PlanLimitExceededException,
    );
  });

  it('meters storage in bytes so sub-gigabyte uploads are measured exactly', async () => {
    // Free plan hard limit is 2GB, currently empty.
    const quarterGb = BYTES_PER_GB / 4;
    usageEventRepository.createQueryBuilder.mockReturnValue(usageSum(BYTES_PER_GB));

    // 1GB used + 1.25GB more = 2.25GB > 2GB -> rejected.
    await expect(
      service.assertWithinHardLimit('org-1', 'storage_gb', quarterGb * 5),
    ).rejects.toBeInstanceOf(PlanLimitExceededException);

    // 1GB used + 0.75GB = 1.75GB <= 2GB -> allowed.
    await expect(
      service.assertWithinHardLimit('org-1', 'storage_gb', quarterGb * 3),
    ).resolves.toBeUndefined();
  });

  it('rejects an email broadcast that exceeds the monthly send limit', async () => {
    // Free plan hard limit is 200 sends this month; 199 already sent.
    usageEventRepository.createQueryBuilder.mockReturnValue(usageSum(199));

    await expect(
      service.assertWithinHardLimit('org-1', 'monthly_email_sends', 2),
    ).rejects.toBeInstanceOf(PlanLimitExceededException);

    await expect(
      service.assertWithinHardLimit('org-1', 'monthly_email_sends', 1),
    ).resolves.toBeUndefined();
  });

  it('enforceHardLimits rejects an organization already over the line', async () => {
    userRepository.count.mockResolvedValue(5); // free plan allows 2 seats

    await expect(service.enforceHardLimits('org-1')).rejects.toThrow(/Staff users limit/);
  });

  it('fails open when the usage ledger is unreadable, so email still sends', async () => {
    // Mirrors production before the migration is applied: the ledger table does
    // not exist yet. Metering must not break the feature it measures.
    usageEventRepository.createQueryBuilder.mockReturnValue(
      queryBuilder({
        getRawOne: jest.fn().mockRejectedValue(new Error('relation "organization_usage_events" does not exist')),
      }),
    );

    await expect(
      service.assertWithinHardLimit('org-1', 'monthly_email_sends', 5),
    ).resolves.toBeUndefined();
  });

  it('reports real usage for every metric, including the ledger-backed ones', async () => {
    formRepository.count.mockResolvedValue(4);
    contactRepository.count.mockResolvedValue(7);
    userRepository.count.mockResolvedValue(3);
    submissionRepository.createQueryBuilder.mockReturnValue(queryBuilder({ getCount: jest.fn().mockResolvedValue(12) }));
    usageEventRepository.createQueryBuilder
      .mockReturnValueOnce(usageSum(55))
      .mockReturnValueOnce(usageSum(5 * BYTES_PER_GB));

    const usage = await service.calculateUsage('org-1');

    expect(usage).toMatchObject({
      organization_id: 'org-1',
      forms_created: 4,
      contacts_total: 7,
      staff_users_total: 3,
      submissions_this_month: 12,
      email_sends_this_month: 55,
      storage_used_bytes: 5 * BYTES_PER_GB,
      storage_used_gb: 5,
    });
  });
});
