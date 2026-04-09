import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Contact } from '../entities/contact.entity';
import { ContactImport, ContactImportStatus } from '../entities/contact-import.entity';
import { Group } from '../../group/entities/group.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { NotificationService } from '../../notification/notification.service';
import { ContactService } from './contact.service';

type ContactWithPasswordSetupToken = Contact & {
  password_setup_token?: string | null;
};

@Injectable()
export class ContactImportService {
  constructor(
    @InjectRepository(ContactImport)
    private contactImportRepository: Repository<ContactImport>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Organization)
    private organizationRepository: Repository<Organization>,
    private contactService: ContactService,
    private notificationService: NotificationService,
    private configService: ConfigService,
  ) {}

  async sendPasswordSetupEmails(organizationId: string, contacts: ContactWithPasswordSetupToken[]) {
    if (!contacts.length) {
      return;
    }

    const organization = await this.organizationRepository.findOne({ where: { id: organizationId } });
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    for (const contact of contacts) {
      const passwordSetupToken = contact.password_setup_token;
      if (!contact.email || !contact.must_reset_password || !passwordSetupToken) {
        continue;
      }

      const resetLink = frontendUrl
        ? `${frontendUrl.replace(/\/$/, '')}/contact-reset?token=${passwordSetupToken}`
        : '';

      if (!resetLink) {
        console.warn('Skipping contact password setup email because FRONTEND_URL is not configured');
        continue;
      }

      try {
        await this.notificationService.sendPasswordResetEmail(organization, contact.email, resetLink, {
          heading: 'Contact Invitation',
          intro: 'Your account has been created. Use the link below to set your password and activate access.',
          expiresInText: '7 days',
          actionLabel: 'Set your password',
        });
      } catch (error) {
        console.warn('Failed to send contact password setup email:', error);
      }
    }
  }

  private validateRow(
    row: Record<string, any>,
    rowIndex: number,
    existingEmails: Set<string>,
    importedEmails: Set<string>,
    validGroupIds: Set<string>,
  ) {
    const errors: string[] = [];

    const hasName = row.name && typeof row.name === 'string' && row.name.trim();
    const hasFirstOrLastName = (row.first_name && typeof row.first_name === 'string' && row.first_name.trim()) ||
                               (row.last_name && typeof row.last_name === 'string' && row.last_name.trim());

    if (!hasName && !hasFirstOrLastName) {
      errors.push('Name is required (provide either name or first_name/last_name)');
    }

    if (!row.email || typeof row.email !== 'string' || !row.email.trim()) {
      errors.push('Email is required');
    } else {
      const normalized = row.email.toLowerCase().trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        errors.push('Email is invalid');
      }
      if (importedEmails.has(normalized)) {
        errors.push('Duplicate email in import payload');
      }
      if (existingEmails.has(normalized)) {
        errors.push('Email already exists in organization');
      }
    }

    if (row.is_active !== undefined && typeof row.is_active !== 'boolean') {
      errors.push('is_active must be a boolean');
    }

    if (row.require_login !== undefined && typeof row.require_login !== 'boolean') {
      errors.push('require_login must be a boolean');
    }

    if (row.must_reset_password !== undefined && typeof row.must_reset_password !== 'boolean') {
      errors.push('must_reset_password must be a boolean');
    }

    if (row.group_ids !== undefined) {
      if (!Array.isArray(row.group_ids)) {
        errors.push('group_ids must be an array');
      } else {
        for (const groupId of row.group_ids) {
          if (typeof groupId !== 'string' || !groupId.trim()) {
            errors.push('group_ids must contain valid IDs');
            continue;
          }
          if (!validGroupIds.has(groupId)) {
            errors.push(`Group '${groupId}' not found`);
          }
        }
      }
    }

    for (const key of ['groups', 'group_paths']) {
      if (row[key] === undefined) {
        continue;
      }
      if (!Array.isArray(row[key])) {
        errors.push(`${key} must be an array`);
        continue;
      }
      for (const token of row[key]) {
        if (typeof token !== 'string' || !token.trim()) {
          errors.push(`${key} must contain non-empty strings`);
          continue;
        }
        const segments = token.split('>').map((segment: string) => segment.trim()).filter(Boolean);
        if (!segments.length) {
          errors.push(`Invalid group path '${token}'`);
        }
      }
    }

    return {
      row_index: rowIndex,
      row,
      errors,
    };
  }

  async validateImport(organizationId: string, contacts: Array<any>, createdBy: string) {
    const existingContacts = await this.contactRepository.find({
      where: { organization_id: organizationId },
      select: ['email'],
    });

    const existingEmails = new Set(
      existingContacts
        .map(c => c.email)
        .filter((email): email is string => typeof email === 'string' && email.trim().length > 0)
        .map(email => email.toLowerCase()),
    );
    const importedEmails = new Set<string>();
    const referencedGroupIds = new Set<string>();

    contacts.forEach(contact => {
      for (const groupId of contact?.group_ids || []) {
        if (typeof groupId === 'string' && groupId.trim()) {
          referencedGroupIds.add(groupId);
        }
      }
    });

    const validGroupIds = new Set<string>();
    if (referencedGroupIds.size) {
      const groups = await this.groupRepository.find({
        where: { organization_id: organizationId, id: In(Array.from(referencedGroupIds)) },
        select: ['id'],
      });
      groups.forEach(group => validGroupIds.add(group.id));
    }

    const validationResults = contacts.map((contact, index) => {
      const result = this.validateRow(contact, index, existingEmails, importedEmails, validGroupIds);
      if (!result.errors.length && contact.email) {
        importedEmails.add(contact.email.toLowerCase().trim());
      }
      return result;
    });

    const errorRows = validationResults.filter(r => r.errors.length);
    const status = errorRows.length ? ContactImportStatus.FAILED : ContactImportStatus.VALIDATED;

    const importJob = this.contactImportRepository.create({
      organization_id: organizationId,
      created_by: createdBy,
      status,
      total_count: contacts.length,
      success_count: contacts.length - errorRows.length,
      failure_count: errorRows.length,
      payload: contacts,
      errors: errorRows,
      completed_at: status === ContactImportStatus.VALIDATED ? new Date() : new Date(),
    });

    await this.contactImportRepository.save(importJob);

    return {
      import_id: importJob.id,
      status: importJob.status,
      total_count: importJob.total_count,
      success_count: importJob.success_count,
      failure_count: importJob.failure_count,
      errors: errorRows,
    };
  }

  async commitImport(organizationId: string, importId: string) {
    const importJob = await this.contactImportRepository.findOne({
      where: { id: importId, organization_id: organizationId },
    });

    if (!importJob) {
      throw new NotFoundException('Import job not found');
    }

    if (importJob.status !== ContactImportStatus.VALIDATED) {
      throw new BadRequestException('Only validated imports can be committed');
    }

    try {
      const contacts = (importJob.payload || []) as Array<any>;
      const createdContacts = await this.contactService.bulkImport(organizationId, contacts);
      await this.sendPasswordSetupEmails(organizationId, createdContacts);

      importJob.status = ContactImportStatus.COMPLETED;
      importJob.success_count = createdContacts.length;
      importJob.failure_count = 0;
      importJob.completed_at = new Date();
      await this.contactImportRepository.save(importJob);

      return {
        import_id: importJob.id,
        status: importJob.status,
        created_count: createdContacts.length,
      };
    } catch (error: any) {
      importJob.status = ContactImportStatus.FAILED;
      importJob.success_count = 0;
      importJob.failure_count = importJob.total_count;
      importJob.errors = [
        {
          row_index: -1,
          row: null,
          errors: [error?.message || 'Failed to commit import'],
        },
      ];
      importJob.completed_at = new Date();
      await this.contactImportRepository.save(importJob);
      throw error;
    }
  }

  async listImports(organizationId: string, page = 1, limit = 20) {
    const [data, total] = await this.contactImportRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
      order: { created_at: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async getImport(organizationId: string, importId: string) {
    return this.contactImportRepository.findOne({
      where: { id: importId, organization_id: organizationId },
    });
  }
}
