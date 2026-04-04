import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ComplianceService, ComplianceRequestStatus } from './compliance.service';
import { Organization } from '../organization/entities/organization.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

describe('ComplianceService', () => {
  let service: ComplianceService;
  let organizationRepository;
  let contactRepository;
  let submissionRepository;
  let auditLogRepository;

  const mockOrganization = {
    id: 'org-123',
    name: 'Test Organization',
    data_retention_contact_days: 1095,
    data_retention_submission_days: 2555,
    auto_purge_retention_enabled: true,
  };

  const mockContact = {
    id: 'contact-123',
    email: 'user@example.com',
    first_name: 'John',
    last_name: 'Doe',
    organization_id: 'org-123',
    created_at: new Date(),
  };

  beforeEach(async () => {
    organizationRepository = {
      findOne: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    contactRepository = {
      findOne: jest.fn(),
      update: jest.fn(),
    };

    submissionRepository = {
      find: jest.fn(),
      delete: jest.fn(),
    };

    auditLogRepository = {
      save: jest.fn(),
      create: jest.fn((dto) => dto),
      find: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        {
          provide: getRepositoryToken(Organization),
          useValue: organizationRepository,
        },
        {
          provide: getRepositoryToken(Contact),
          useValue: contactRepository,
        },
        {
          provide: getRepositoryToken(Submission),
          useValue: submissionRepository,
        },
        {
          provide: getRepositoryToken(ActivityLog),
          useValue: auditLogRepository,
        },
      ],
    }).compile();

    service = module.get<ComplianceService>(ComplianceService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestDataExport', () => {
    it('should create data export request', async () => {
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      auditLogRepository.save.mockResolvedValueOnce({});

      const request = await service.requestDataExport('org-123', 'contact-123', 'user-123');

      expect(request.request_type).toBe('data_export');
      expect(request.status).toBe('pending');
      expect(request.target_contact_id).toBe('contact-123');
    });

    it('should throw if contact not found', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      await expect(
        service.requestDataExport('org-123', 'contact-123', 'user-123'),
      ).rejects.toThrow('Contact not found');
    });
  });

  describe('requestDataDeletion', () => {
    it('should create data deletion request', async () => {
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      auditLogRepository.save.mockResolvedValueOnce({});

      const request = await service.requestDataDeletion('org-123', 'contact-123', 'user-123');

      expect(request.request_type).toBe('data_deletion');
      expect(request.status).toBe('pending');
    });

    it('should log deletion request with GDPR reference', async () => {
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.requestDataDeletion('org-123', 'contact-123', 'user-123');

      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATA_DELETION_REQUESTED',
          metadata: expect.objectContaining({
            reason: 'right_to_be_forgotten',
          }),
        }),
      );
    });
  });

  describe('exportContactData', () => {
    it('should export contact data as CSV', async () => {
      const submissions = [
        { id: 'sub-1', form_id: 'form-1', data: { name: 'Test' } },
      ];
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      submissionRepository.find.mockResolvedValueOnce(submissions);
      auditLogRepository.save.mockResolvedValueOnce({});

      const csv = await service.exportContactData('contact-123', 'org-123');

      expect(csv).toContain('Contact ID');
      expect(csv).toContain('contact-123');
      expect(csv).toContain('user@example.com');
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_DATA_EXPORTED',
        }),
      );
    });

    it('should throw if contact not found', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.exportContactData('contact-123', 'org-123')).rejects.toThrow(
        'Contact not found',
      );
    });
  });

  describe('deleteContactData', () => {
    it('should anonymize contact data', async () => {
      contactRepository.findOne.mockResolvedValueOnce(mockContact);
      contactRepository.update.mockResolvedValueOnce({ affected: 1 });
      auditLogRepository.save.mockResolvedValueOnce({});

      await service.deleteContactData('contact-123', 'org-123');

      expect(contactRepository.update).toHaveBeenCalledWith(
        { id: 'contact-123', organization_id: 'org-123' },
        expect.objectContaining({
          first_name: 'Anonymized',
          email: null,
        }),
      );
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'CONTACT_DATA_DELETED',
          metadata: expect.objectContaining({
            deletion_type: 'anonymization',
          }),
        }),
      );
    });

    it('should throw if contact not found', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.deleteContactData('contact-123', 'org-123')).rejects.toThrow(
        'Contact not found',
      );
    });
  });

  describe('applyDataRetentionPolicies', () => {
    it('should apply retention policies', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      contactRepository.update.mockResolvedValueOnce({ affected: 10 });
      submissionRepository.delete.mockResolvedValueOnce({ affected: 50 });
      auditLogRepository.delete.mockResolvedValueOnce({ affected: 100 });
      organizationRepository.save.mockResolvedValueOnce(mockOrganization);
      auditLogRepository.save.mockResolvedValueOnce({});

      const result = await service.applyDataRetentionPolicies('org-123');

      expect(result.contactsAnonymized).toBe(10);
      expect(result.submissionsDeleted).toBe(50);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'DATA_RETENTION_PURGE',
        }),
      );
    });

    it('should throw if organization not found', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.applyDataRetentionPolicies('org-123')).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  describe('getDataRetentionPolicy', () => {
    it('should return retention policy', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);

      const policy = await service.getDataRetentionPolicy('org-123');

      expect(policy.contact_data_retention_days).toBe(1095);
      expect(policy.submission_data_retention_days).toBe(2555);
      expect(policy.auto_purge_enabled).toBe(true);
    });

    it('should use default retention days if not configured', async () => {
      organizationRepository.findOne.mockResolvedValueOnce({
        id: 'org-123',
        data_retention_contact_days: null,
      });

      const policy = await service.getDataRetentionPolicy('org-123');

      expect(policy.contact_data_retention_days).toBe(1095); // Default 3 years
      expect(policy.submission_data_retention_days).toBe(2555); // Default 7 years
    });

    it('should throw if organization not found', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(null);

      await expect(service.getDataRetentionPolicy('org-123')).rejects.toThrow(
        'Organization not found',
      );
    });
  });

  describe('updateDataRetentionPolicy', () => {
    it('should update retention policy', async () => {
      organizationRepository.findOne.mockResolvedValueOnce(mockOrganization);
      organizationRepository.save.mockResolvedValueOnce({
        ...mockOrganization,
        contact_data_retention_days: 730,
      });
      auditLogRepository.save.mockResolvedValueOnce({});

      const updated = await service.updateDataRetentionPolicy('org-123', {
        contact_data_retention_days: 730,
      });

      expect(updated.contact_data_retention_days).toBe(730);
      expect(auditLogRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'RETENTION_POLICY_UPDATED',
        }),
      );
    });
  });

  describe('getComplianceAuditTrail', () => {
    it('should retrieve compliance audit trail', async () => {
      const auditLogs = [
        { id: 'log-1', action: 'DATA_EXPORT_REQUESTED', created_at: new Date() },
      ];
      auditLogRepository.find.mockResolvedValueOnce(auditLogs);

      const trail = await service.getComplianceAuditTrail('org-123', 90);

      expect(trail).toHaveLength(1);
      expect(trail[0].action).toBe('DATA_EXPORT_REQUESTED');
    });
  });
});
