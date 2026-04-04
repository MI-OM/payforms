import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BillingService } from './billing.service';
import { Organization } from '../organization/entities/organization.entity';
import { Form } from '../form/entities/form.entity';
import { Contact } from '../contact/entities/contact.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

describe('BillingService', () => {
  let service: BillingService;
  let organizationRepository;
  let formRepository;
  let contactRepository;
  let auditLogRepository;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    billing_plan_tier: 'free',
  };

  beforeEach(async () => {
    organizationRepository = {
      findOne: jest.fn().mockResolvedValue(mockOrganization),
      save: jest.fn(),
    };

    formRepository = {
      count: jest.fn(),
    };

    contactRepository = {
      count: jest.fn(),
    };

    auditLogRepository = {
      save: jest.fn(),
      create: jest.fn((dto) => dto),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        {
          provide: getRepositoryToken(Organization),
          useValue: organizationRepository,
        },
        {
          provide: getRepositoryToken(Form),
          useValue: formRepository,
        },
        {
          provide: getRepositoryToken(Contact),
          useValue: contactRepository,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: auditLogRepository,
        },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrganizationPlan', () => {
    it('should return free plan by default', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      const plan = await service.getOrganizationPlan('org-123');

      expect(plan.tier).toBe('free');
      expect(plan.name).toBe('Free');
      expect(plan.soft_limits.forms).toBe(5);
      expect(plan.hard_limits.contacts).toBe(1000);
    });

    it('should return professional plan when configured', async () => {
      organizationRepository.findOne.mockResolvedValueOnce({
        ...mockOrganization,
        billing_plan_tier: 'professional',
      });

      const plan = await service.getOrganizationPlan('org-123');

      expect(plan.tier).toBe('professional');
      expect(plan.soft_limits.forms).toBe(500);
      expect(plan.hard_limits.contacts).toBe(100000);
    });

    it('should throw if organization not found', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getOrganizationPlan('org-123')).rejects.toThrow(
        'Organization not found',
      );
    });

    it('should throw if plan tier is invalid', async () => {
      organizationRepository.findOne.mockResolvedValueOnce({
        ...mockOrganization,
        billing_plan_tier: 'invalid_plan',
      });

      await expect(service.getOrganizationPlan('org-123')).rejects.toThrow(
        'Invalid billing plan',
      );
    });
  });

  describe('calculateUsage', () => {
    it('should calculate current organization usage', async () => {
      formRepository.count.mockResolvedValueOnce(10);
      contactRepository.count.mockResolvedValueOnce(500);

      const usage = await service.calculateUsage('org-123');

      expect(usage.forms_created).toBe(10);
      expect(usage.contacts_total).toBe(500);
      expect(usage.organization_id).toBe('org-123');
    });
  });

  describe('checkLimits', () => {
    it('should return within limits when usage is below soft limits', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      formRepository.count.mockResolvedValueOnce(3);
      contactRepository.count.mockResolvedValueOnce(100);

      const result = await service.checkLimits('org-123');

      expect(result.withinLimits).toBe(true);
      expect(result.violations.length).toBe(0);
      expect(result.warnings.length).toBe(0);
    });

    it('should generate warnings when approaching soft limits', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      formRepository.count.mockResolvedValueOnce(4); // Close to soft limit of 5
      contactRepository.count.mockResolvedValueOnce(450); // Close to soft limit of 500

      const result = await service.checkLimits('org-123');

      expect(result.withinLimits).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should generate violations when hard limits exceeded', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      formRepository.count.mockResolvedValueOnce(15); // Exceeds hard limit of 10
      contactRepository.count.mockResolvedValueOnce(500);

      const result = await service.checkLimits('org-123');

      expect(result.withinLimits).toBe(false);
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations[0]).toContain('Forms limit');
    });
  });

  describe('enforceHardLimits', () => {
    it('should allow request when within limits', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      formRepository.count.mockResolvedValueOnce(3);
      contactRepository.count.mockResolvedValueOnce(100);

      await expect(service.enforceHardLimits('org-123')).resolves.toBeUndefined();
    });

    it('should throw when hard limits exceeded', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      formRepository.count.mockResolvedValueOnce(15);
      contactRepository.count.mockResolvedValueOnce(500);
      auditLogRepository.save.mockResolvedValueOnce({});

      await expect(service.enforceHardLimits('org-123')).rejects.toThrow(
        'Billing limits exceeded',
      );
    });
  });

  describe('upgradePlan', () => {
    it('should upgrade organization plan', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      organizationRepository.save.mockResolvedValueOnce({
        ...mockOrganization,
        billing_plan_tier: 'professional',
      });
      auditLogRepository.save.mockResolvedValueOnce({});

      const result = await service.upgradePlan('org-123', 'professional');

      expect(result.billing_plan_tier).toBe('professional');
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PLAN_UPGRADED',
        }),
      );
    });

    it('should throw on invalid plan tier', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      await expect(service.upgradePlan('org-123', 'invalid_plan')).rejects.toThrow(
        'Invalid plan tier',
      );
    });
  });

  describe('getUsageReport', () => {
    it('should generate usage report', async () => {
      organizationRepository.findOne.mockResolvedValue(mockOrganization);
      formRepository.count.mockResolvedValue(10);
      contactRepository.count.mockResolvedValue(500);

      const report = await service.getUsageReport('org-123');

      expect(report.organization_id).toBe('org-123');
      expect(report.plan).toBeDefined();
      expect(report.usage).toBeDefined();
      expect(report.limits).toBeDefined();
      expect(report.recommendations).toBeDefined();
    });

    it('should include upgrade recommendation for large contacts on free plan', async () => {
      organizationRepository.findOne.mockResolvedValueOnce({
        id: 'org-123',
        name: 'Test Organization',
        billing_plan_tier: 'free',
      });
      formRepository.count.mockResolvedValueOnce(15);
      contactRepository.count.mockResolvedValueOnce(2000);

      const report = await service.getUsageReport('org-123');

      expect(report.recommendations).toContainEqual(
        expect.stringContaining('Starter plan recommended'),
      );
    });
  });
});

