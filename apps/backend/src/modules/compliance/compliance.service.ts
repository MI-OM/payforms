import { Injectable, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import { Organization } from '../organization/entities/organization.entity';
import { Contact } from '../contact/entities/contact.entity';
import { Submission } from '../submission/entities/submission.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';

export enum ComplianceRequestType {
  DATA_EXPORT = 'data_export',
  DATA_DELETION = 'data_deletion',
  DATA_RETENTION_PURGE = 'data_retention_purge',
}

export enum ComplianceRequestStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

export interface ComplianceRequest {
  id: string;
  organization_id: string;
  request_type: ComplianceRequestType;
  status: ComplianceRequestStatus;
  requested_by: string;
  target_contact_id?: string;
  initiated_at: Date;
  completed_at?: Date;
  expiry_at: Date;
  result_file_path?: string;
  metadata: Record<string, any>;
}

export interface DataRetentionPolicy {
  organization_id: string;
  contact_data_retention_days: number;
  submission_data_retention_days: number;
  audit_log_retention_days: number;
  auto_purge_enabled: boolean;
  last_purge_at?: Date;
}

@Injectable()
export class ComplianceService {
  private readonly DEFAULT_CONTACT_RETENTION_DAYS = 1095; // 3 years
  private readonly DEFAULT_SUBMISSION_RETENTION_DAYS = 2555; // 7 years GDPR
  private readonly DEFAULT_AUDIT_RETENTION_DAYS = 2555; // 7 years for audit trail
  private readonly REQUEST_EXPIRY_DAYS = 30;

  constructor(
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(ActivityLog)
    private auditLogRepository: Repository<ActivityLog>,
  ) {}

  /**
   * Request data export for contact (GDPR right to data portability)
   */
  async requestDataExport(
    organizationId: string,
    contactId: string,
    requestedBy: string,
  ): Promise<ComplianceRequest> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    // In production, this would be persisted to a compliance_requests table
    const expiryAt = new Date();
    expiryAt.setDate(expiryAt.getDate() + this.REQUEST_EXPIRY_DAYS);

    const request: ComplianceRequest = {
      id: `export_${Date.now()}`,
      organization_id: organizationId,
      request_type: ComplianceRequestType.DATA_EXPORT,
      status: ComplianceRequestStatus.PENDING,
      requested_by: requestedBy,
      target_contact_id: contactId,
      initiated_at: new Date(),
      expiry_at: expiryAt,
      metadata: {
        contact_email: contact.email,
        includes_submissions: true,
      },
    };

    // Log compliance request  
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        user_id: requestedBy,
        entity_id: contactId,
        entity_type: 'compliance',
        action: 'DATA_EXPORT_REQUESTED',
        metadata: {
          contact_email: contact.email,
        },
      }),
    );

    return request;
  }

  /**
   * Request data deletion (GDPR right to be forgotten)
   */
  async requestDataDeletion(
    organizationId: string,
    contactId: string,
    requestedBy: string,
  ): Promise<ComplianceRequest> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    const expiryAt = new Date();
    expiryAt.setDate(expiryAt.getDate() + this.REQUEST_EXPIRY_DAYS);

    const request: ComplianceRequest = {
      id: `delete_${Date.now()}`,
      organization_id: organizationId,
      request_type: ComplianceRequestType.DATA_DELETION,
      status: ComplianceRequestStatus.PENDING,
      requested_by: requestedBy,
      target_contact_id: contactId,
      initiated_at: new Date(),
      expiry_at: expiryAt,
      metadata: {
        contact_email: contact.email,
        anonymize_instead_of_delete: true, // Prefer anonymization for audit trail
      },
    };

    // Log compliance request
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        user_id: requestedBy,
        entity_id: contactId,
        entity_type: 'compliance',
        action: 'DATA_DELETION_REQUESTED',
        metadata: {
          contact_email: contact.email,
          reason: 'right_to_be_forgotten',
        },
      }),
    );

    return request;
  }

  /**
   * Export contact and submission data as CSV
   */
  async exportContactData(contactId: string, organizationId: string): Promise<string> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    const submissions = await this.submissionRepository.find({
      where: { contact_id: contactId },
    });

    // Generate CSV content
    const csv = this.generateExportCsv(contact, submissions);

    // In production, this would be stored in secure storage with encryption
    const fileName = `contact_export_${contactId}_${Date.now()}.csv`;

    // Log export
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: contactId,
        entity_type: 'compliance',
        action: 'CONTACT_DATA_EXPORTED',
        metadata: {
          submission_count: submissions.length,
          file_name: fileName,
        },
      }),
    );

    return csv;
  }

  /**
   * Delete or anonymize contact data
   */
  async deleteContactData(contactId: string, organizationId: string): Promise<void> {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
    });

    if (!contact) {
      throw new BadRequestException('Contact not found');
    }

    // Option 1: Hard delete (complete removal)
    // Option 2: Soft delete via anonymization (preferred for audit trail)

    // Anonymize contact data
    await this.contactRepository.update(
      { id: contactId, organization_id: organizationId },
      {
        first_name: 'Anonymized',
        middle_name: null,
        last_name: `User_${contactId.substring(0, 8)}`,
        email: null,
        phone: null,
        gender: null,
        student_id: null,
        guardian_name: null,
        guardian_email: null,
        guardian_phone: null,
        external_id: null,
        password_hash: null,
      },
    );

    // Log data deletion
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: contactId,
        entity_type: 'compliance',
        action: 'CONTACT_DATA_DELETED',
        metadata: {
          deletion_type: 'anonymization',
          original_email: contact.email,
        },
      }),
    );
  }

  /**
   * Apply data retention policies - purge old data
   */
  async applyDataRetentionPolicies(organizationId: string): Promise<{
    contactsAnonymized: number;
    submissionsDeleted: number;
    auditLogsArchived: number;
  }> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    // Get or create default retention policy
    const retentionContactDays =
      org.data_retention_contact_days || this.DEFAULT_CONTACT_RETENTION_DAYS;
    const retentionSubmissionDays =
      org.data_retention_submission_days || this.DEFAULT_SUBMISSION_RETENTION_DAYS;
    const retentionAuditDays =
      org.data_retention_audit_days || this.DEFAULT_AUDIT_RETENTION_DAYS;

    // Calculate cutoff dates
    const contactCutoff = new Date();
    contactCutoff.setDate(contactCutoff.getDate() - retentionContactDays);

    const submissionCutoff = new Date();
    submissionCutoff.setDate(submissionCutoff.getDate() - retentionSubmissionDays);

    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - retentionAuditDays);

    // Anonymize old contacts
    const contactResult = await this.contactRepository.update(
      { organization_id: organizationId, created_at: LessThan(contactCutoff) },
      {
        first_name: 'Anonymized',
        last_name: 'Retained',
        email: null,
        phone: null,
        password_hash: null,
      },
    );

    // Delete old submissions
    const submissionResult = await this.submissionRepository.delete({
      organization_id: organizationId,
      created_at: LessThan(submissionCutoff),
    });

    // Archive old audit logs (in production, move to archive storage)
    await this.auditLogRepository.delete({
      organization_id: organizationId,
      created_at: LessThan(auditCutoff),
    });

    // Update last purge timestamp
    org.last_data_retention_purge_at = new Date();
    await this.organizationRepository.save(org);

    // Log retention policy application
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: organizationId,
        entity_type: 'compliance',
        action: 'DATA_RETENTION_PURGE',
        metadata: {
          contacts_anonymized: contactResult.affected || 0,
          submissions_deleted: submissionResult.affected || 0,
          retention_days: {
            contact: retentionContactDays,
            submission: retentionSubmissionDays,
            audit: retentionAuditDays,
          },
        },
      }),
    );

    return {
      contactsAnonymized: contactResult.affected || 0,
      submissionsDeleted: submissionResult.affected || 0,
      auditLogsArchived: 0, // Placeholder
    };
  }

  /**
   * Get data retention policy for organization
   */
  async getDataRetentionPolicy(organizationId: string): Promise<DataRetentionPolicy> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    const contactRetentionDays =
      org.data_retention_contact_days;
    const submissionRetentionDays =
      org.data_retention_submission_days;
    const auditRetentionDays =
      org.data_retention_audit_days;

    return {
      organization_id: organizationId,
      contact_data_retention_days:
        contactRetentionDays ?? this.DEFAULT_CONTACT_RETENTION_DAYS,
      submission_data_retention_days:
        submissionRetentionDays ?? this.DEFAULT_SUBMISSION_RETENTION_DAYS,
      audit_log_retention_days:
        auditRetentionDays ?? this.DEFAULT_AUDIT_RETENTION_DAYS,
      auto_purge_enabled: org.auto_purge_retention_enabled !== false,
      last_purge_at: org.last_data_retention_purge_at ?? undefined,
    };
  }

  /**
   * Update data retention policy
   */
  async updateDataRetentionPolicy(
    organizationId: string,
    policy: Partial<DataRetentionPolicy>,
  ): Promise<DataRetentionPolicy> {
    const org = await this.organizationRepository.findOne({
      where: { id: organizationId },
    });

    if (!org) {
      throw new BadRequestException('Organization not found');
    }

    if (policy.contact_data_retention_days)
      org.data_retention_contact_days = policy.contact_data_retention_days;
    if (policy.submission_data_retention_days)
      org.data_retention_submission_days = policy.submission_data_retention_days;
    if (policy.audit_log_retention_days)
      org.data_retention_audit_days = policy.audit_log_retention_days;
    if (policy.auto_purge_enabled !== undefined)
      org.auto_purge_retention_enabled = policy.auto_purge_enabled;

    const updatedOrg = await this.organizationRepository.save(org);

    // Log policy change
    await this.auditLogRepository.save(
      this.auditLogRepository.create({
        organization_id: organizationId,
        entity_id: organizationId,
        entity_type: 'compliance',
        action: 'RETENTION_POLICY_UPDATED',
        metadata: { policy },
      }),
    );

    const contactRetentionDays =
      org.data_retention_contact_days;
    const submissionRetentionDays =
      org.data_retention_submission_days;
    const auditRetentionDays =
      org.data_retention_audit_days;

    return {
      organization_id: organizationId,
      contact_data_retention_days:
        contactRetentionDays ?? this.DEFAULT_CONTACT_RETENTION_DAYS,
      submission_data_retention_days:
        submissionRetentionDays ?? this.DEFAULT_SUBMISSION_RETENTION_DAYS,
      audit_log_retention_days:
        auditRetentionDays ?? this.DEFAULT_AUDIT_RETENTION_DAYS,
      auto_purge_enabled: updatedOrg.auto_purge_retention_enabled !== false,
      last_purge_at: updatedOrg.last_data_retention_purge_at ?? undefined,
    };
  }

  /**
   * Get audit trail for compliance purposes
   */
  async getComplianceAuditTrail(organizationId: string, days: number = 90): Promise<ActivityLog[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    return this.auditLogRepository.find({
      where: {
        organization_id: organizationId,
        created_at: LessThan(cutoffDate),
      },
      order: { created_at: 'DESC' },
      take: 10000, // Reasonable limit
    });
  }

  /**
   * Generate CSV export of contact data
   */
  private generateExportCsv(
    contact: Contact,
    submissions: Submission[],
  ): string {
    const headers = [
      'Contact ID',
      'Email',
      'First Name',
      'Last Name',
      'Phone',
      'Student ID',
      'Created At',
      'Submission ID',
      'Form ID',
      'Submission Data',
      'Submitted At',
    ];

    const lines = [headers.join(',')];

    // Add contact data row
    lines.push(
      [
        contact.id,
        contact.email || '',
        contact.first_name || '',
        contact.last_name || '',
        contact.phone || '',
        contact.student_id || '',
        contact.created_at?.toISOString() || '',
        '', // Submission fields empty for contact row
        '',
        '',
        '',
      ]
        .map((field) => `"${field}"`)
        .join(','),
    );

    // Add submission data rows
    submissions.forEach((submission: any) => {
      lines.push(
        [
          contact.id,
          contact.email || '',
          contact.first_name || '',
          contact.last_name || '',
          contact.phone || '',
          contact.student_id || '',
          contact.created_at?.toISOString() || '',
          submission.id,
          submission.form_id,
          JSON.stringify(submission.data),
          submission.created_at?.toISOString() || '',
        ]
          .map((field) => `"${field}"`)
          .join(','),
      );
    });

    return lines.join('\n');
  }
}
