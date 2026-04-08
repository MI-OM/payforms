import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as crypto from 'crypto';
import { Contact } from '../entities/contact.entity';
import { Payment } from '../../payment/entities/payment.entity';
import { Submission } from '../../submission/entities/submission.entity';
import { Group } from '../../group/entities/group.entity';
import { CreateContactDto, UpdateContactDto, ContactQueryDto } from '../dto/contact.dto';

type ContactImportInput = {
  first_name?: string;
  middle_name?: string;
  last_name?: string;
  email: string;
  phone?: string;
  gender?: string;
  student_id?: string;
  external_id?: string;
  guardian_name?: string;
  guardian_email?: string;
  guardian_phone?: string;
  group_ids?: string[];
  groups?: string[];
  group_paths?: string[];
  require_login?: boolean;
  is_active?: boolean;
  must_reset_password?: boolean;
};

type ContactWithPasswordSetupToken = Contact & {
  password_setup_token?: string | null;
};

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    @InjectRepository(Payment)
    private paymentRepository: Repository<Payment>,
    @InjectRepository(Submission)
    private submissionRepository: Repository<Submission>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
  ) {}

  async create(organizationId: string, dto: CreateContactDto) {
    const { require_login, must_reset_password, ...contactFields } = dto;
    const requireLogin = require_login ?? true;
    const mustResetPassword = must_reset_password ?? requireLogin;
    const passwordResetToken = mustResetPassword ? this.generateOpaqueToken() : null;
    const passwordResetExpiresAt = mustResetPassword
      ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
      : null;

    const contact = this.contactRepository.create({
      organization_id: organizationId,
      ...contactFields,
      email: this.normalizeEmail(contactFields.email),
      is_active: true,
      must_reset_password: mustResetPassword,
      password_reset_token: passwordResetToken ? this.hashOpaqueToken(passwordResetToken) : null,
      password_reset_expires_at: passwordResetExpiresAt,
    });
    const savedContact = await this.contactRepository.save(contact);
    return Object.assign(savedContact, {
      password_setup_token: passwordResetToken,
    }) as ContactWithPasswordSetupToken;
  }

  async findByOrganization(
    organizationId: string,
    page: number = 1,
    limit: number = 20,
    groupId?: string,
    filters: Partial<ContactQueryDto> = {},
  ) {
    const qb = this.contactRepository.createQueryBuilder('contact')
      .leftJoinAndSelect('contact.groups', 'group')
      .where('contact.organization_id = :organizationId', { organizationId });

    if (groupId) {
      qb.andWhere('group.id = :groupId', { groupId });
    }

    if (filters.student_id) {
      qb.andWhere('contact.student_id ILIKE :student_id', { student_id: `%${filters.student_id}%` });
    }

    if (filters.first_name) {
      qb.andWhere('contact.first_name ILIKE :first_name', { first_name: `%${filters.first_name}%` });
    }

    if (filters.last_name) {
      qb.andWhere('contact.last_name ILIKE :last_name', { last_name: `%${filters.last_name}%` });
    }

    if (filters.email) {
      qb.andWhere('contact.email ILIKE :email', { email: `%${filters.email}%` });
    }

    if (filters.external_id) {
      qb.andWhere('contact.external_id ILIKE :external_id', { external_id: `%${filters.external_id}%` });
    }

    const [data, total] = await qb
      .distinct(true)
      .orderBy('contact.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async exportContacts(organizationId: string, groupId?: string) {
    const qb = this.contactRepository.createQueryBuilder('contact')
      .leftJoinAndSelect('contact.groups', 'group')
      .where('contact.organization_id = :organizationId', { organizationId });

    if (groupId) {
      qb.andWhere('group.id = :groupId', { groupId });
    }

    const contacts = await qb.distinct(true).orderBy('contact.created_at', 'DESC').getMany();
    const allGroups = await this.groupRepository.find({ where: { organization_id: organizationId } });
    const groupPathMap = this.buildGroupPathMap(allGroups);

    const rows = contacts.map(contact => {
      const contactGroups = contact.groups || [];
      const groupNames = contactGroups.map(group => group.name).sort().join('; ');
      const groupPaths = contactGroups
        .map(group => groupPathMap.get(group.id) || group.name)
        .sort()
        .join('; ');
      const requireLogin = contact.must_reset_password || !!contact.password_hash;

      return [
        contact.first_name ?? '',
        contact.middle_name ?? '',
        contact.last_name ?? '',
        contact.email,
        contact.phone ?? '',
        contact.gender ?? '',
        contact.student_id ?? '',
        contact.external_id ?? '',
        contact.guardian_name ?? '',
        contact.guardian_email ?? '',
        contact.guardian_phone ?? '',
        contact.is_active ? 'active' : 'inactive',
        contact.is_active ? '1' : '0',
        requireLogin ? '1' : '0',
        contact.must_reset_password ? '1' : '0',
        groupNames,
        groupPaths,
        contact.created_at.toISOString(),
      ].map(value => this.escapeCsv(value)).join(',');
    });

    return `first_name,middle_name,last_name,email,phone,gender,student_id,external_id,guardian_name,guardian_email,guardian_phone,status,is_active,require_login,must_reset_password,groups,group_paths,created_at\n${rows.join('\n')}`;
  }

  async findById(organizationId: string, id: string) {
    return this.contactRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['groups'],
    });
  }

  async getContactWithGroups(organizationId: string, id: string) {
    const contact = await this.contactRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['groups', 'groups.parent_group'],
    });

    if (!contact) {
      return null;
    }

    const groupMemberships = (contact.groups || []).map(group => {
      const ancestry: string[] = [];
      let current = group;
      while (current) {
        ancestry.unshift(current.name);
        current = (current as any).parent_group;
      }
      return {
        id: group.id,
        name: group.name,
        parent_group_id: group.parent_group_id,
        path: ancestry.join(' > '),
      };
    });

    return {
      ...contact,
      groups: groupMemberships,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateContactDto) {
    const updatePayload = {
      ...dto,
      email: dto.email ? this.normalizeEmail(dto.email) : dto.email,
    };

    await this.contactRepository.update({ id, organization_id: organizationId }, updatePayload);
    return this.findById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    return this.contactRepository.delete({ id, organization_id: organizationId });
  }

  async findByEmail(organizationId: string, email: string) {
    return this.contactRepository.findOne({
      where: { organization_id: organizationId, email: this.normalizeEmail(email) },
    });
  }

  async findByExternalId(organizationId: string, externalId: string) {
    return this.contactRepository.findOne({
      where: { organization_id: organizationId, external_id: externalId },
    });
  }

  async getTransactionHistory(
    organizationId: string,
    contactId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const contact = await this.findById(organizationId, contactId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const qb = this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('submission.contact_id = :contactId', { contactId });

    const [data, total] = await qb
      .orderBy('payment.created_at', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data, total, page, limit };
  }

  async exportTransactionHistory(organizationId: string, contactId: string) {
    const contact = await this.findById(organizationId, contactId);
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const payments = await this.paymentRepository.createQueryBuilder('payment')
      .leftJoinAndSelect('payment.submission', 'submission')
      .where('payment.organization_id = :organizationId', { organizationId })
      .andWhere('submission.contact_id = :contactId', { contactId })
      .orderBy('payment.created_at', 'DESC')
      .getMany();

    const rows = payments.map(payment =>
      [
        payment.id,
        payment.reference,
        payment.amount,
        payment.status,
        payment.paid_at ? payment.paid_at.toISOString() : '',
        payment.created_at.toISOString(),
        payment.submission?.id ?? '',
        payment.submission?.form_id ?? '',
        contact.id,
        contact.email,
      ].map(value => this.escapeCsv(value)).join(','),
    );

    return `id,reference,amount,status,paid_at,created_at,submission_id,form_id,contact_id,contact_email\n${rows.join('\n')}`;
  }

  async createFromPublic(organizationId: string, first_name: string, last_name?: string, email?: string) {
    const contact = this.contactRepository.create({
      organization_id: organizationId,
      first_name: first_name?.trim(),
      last_name: last_name?.trim(),
      email: email ? this.normalizeEmail(email) : email,
      is_active: true,
      must_reset_password: false,
    });
    return this.contactRepository.save(contact);
  }

  async bulkImport(organizationId: string, contacts: ContactImportInput[]) {
    if (!contacts?.length) {
      return [];
    }

    const normalizedRows = contacts.map(contact => this.normalizeImportRow(contact));

    const seenEmails = new Set<string>();
    for (let index = 0; index < normalizedRows.length; index += 1) {
      const row = normalizedRows[index];
      if (!row.email) {
        throw new BadRequestException(`Row ${index + 1}: email is required`);
      }
      if (seenEmails.has(row.email)) {
        throw new BadRequestException(`Duplicate email '${row.email}' in import payload`);
      }
      seenEmails.add(row.email);
    }

    const existingContacts = await this.contactRepository.find({
      where: { organization_id: organizationId, email: In(Array.from(seenEmails)) },
      select: ['email'],
    });

    if (existingContacts.length) {
      const existingEmails = existingContacts.map(contact => contact.email).sort();
      throw new BadRequestException(`Contacts already exist for emails: ${existingEmails.join(', ')}`);
    }

    const organizationGroups = await this.groupRepository.find({
      where: { organization_id: organizationId },
      order: { created_at: 'ASC' },
    });
    const groupById = new Map(organizationGroups.map(group => [group.id, group]));
    const groupByKey = new Map(
      organizationGroups.map(group => [this.buildGroupLookupKey(group.name, group.parent_group_id), group]),
    );

    const contactEntities: ContactWithPasswordSetupToken[] = [];
    for (const row of normalizedRows) {
      const groups = await this.resolveImportGroups(organizationId, row, groupById, groupByKey);
      const requireLogin = row.require_login ?? true;
      const mustResetPassword = row.must_reset_password ?? requireLogin;
      const passwordResetToken = mustResetPassword ? this.generateOpaqueToken() : null;
      const passwordResetExpiresAt = mustResetPassword
        ? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7)
        : null;

      contactEntities.push(
        Object.assign(
          this.contactRepository.create({
          organization_id: organizationId,
          first_name: row.first_name,
          middle_name: row.middle_name,
          last_name: row.last_name,
          email: row.email,
          phone: row.phone,
          gender: row.gender,
          student_id: row.student_id,
          external_id: row.external_id,
          guardian_name: row.guardian_name,
          guardian_email: row.guardian_email,
          guardian_phone: row.guardian_phone,
          is_active: row.is_active ?? true,
          must_reset_password: mustResetPassword,
          password_reset_token: passwordResetToken ? this.hashOpaqueToken(passwordResetToken) : null,
          password_reset_expires_at: passwordResetExpiresAt,
          groups,
          }),
          {
            password_setup_token: passwordResetToken,
          },
        ),
      );
    }

    const savedContacts = await this.contactRepository.save(contactEntities);
    return savedContacts.map((contact, index) => Object.assign(contact, {
      password_setup_token: contactEntities[index]?.password_setup_token ?? null,
    })) as ContactWithPasswordSetupToken[];
  }

  parseCsvImport(csv: string): ContactImportInput[] {
    const rows = this.parseCsv(csv);
    if (!rows.length) {
      return [];
    }

    const header = rows[0].map(cell => String(cell || '').trim().toLowerCase());
    const contacts: ContactImportInput[] = [];

    for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      if (row.length === 1 && !row[0]?.trim()) {
        continue;
      }

      const contact = {} as ContactImportInput;
      for (let colIndex = 0; colIndex < header.length; colIndex += 1) {
        const column = header[colIndex];
        const value = row[colIndex] ?? '';

        switch (column) {
          case 'name': {
            const fullName = String(value).trim();
            if (fullName) {
              const parts = fullName.split(/\s+/).filter(Boolean);
              if (!contact.first_name) {
                contact.first_name = parts[0] || undefined;
              }
              if (!contact.last_name) {
                contact.last_name = parts.slice(1).join(' ') || undefined;
              }
            }
            break;
          }
          case 'first_name':
            contact.first_name = String(value).trim() || undefined;
            break;
          case 'middle_name':
            contact.middle_name = String(value).trim() || undefined;
            break;
          case 'last_name':
            contact.last_name = String(value).trim() || undefined;
            break;
          case 'email':
            contact.email = String(value).trim();
            break;
          case 'phone':
            contact.phone = String(value).trim() || undefined;
            break;
          case 'gender':
            contact.gender = String(value).trim() || undefined;
            break;
          case 'student_id':
            contact.student_id = String(value).trim() || undefined;
            break;
          case 'external_id':
            contact.external_id = String(value).trim() || undefined;
            break;
          case 'guardian_name':
            contact.guardian_name = String(value).trim() || undefined;
            break;
          case 'guardian_email':
            contact.guardian_email = String(value).trim() || undefined;
            break;
          case 'guardian_phone':
            contact.guardian_phone = String(value).trim() || undefined;
            break;
          case 'group_ids':
            contact.group_ids = this.parseCsvList(value);
            break;
          case 'groups':
            contact.groups = this.parseCsvList(value);
            break;
          case 'group_paths':
            contact.group_paths = this.parseCsvList(value);
            break;
          case 'require_login':
            contact.require_login = this.parseCsvBoolean(value);
            break;
          case 'is_active':
            contact.is_active = this.parseCsvBoolean(value);
            break;
          case 'must_reset_password':
            contact.must_reset_password = this.parseCsvBoolean(value);
            break;
          default:
            break;
        }
      }

      contacts.push(contact);
    }

    return contacts;
  }

  private parseCsv(csv: string): string[][] {
    return csv
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => this.parseCsvLine(line));
  }

  private parseCsvLine(line: string): string[] {
    const fields: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }

        continue;
      }

      if (char === ',' && !inQuotes) {
        fields.push(field);
        field = '';
        continue;
      }

      field += char;
    }

    fields.push(field);
    return fields.map(value => value.trim());
  }

  private parseCsvList(value: unknown): string[] | undefined {
    if (value === undefined || value === null) {
      return undefined;
    }
    const normalized = String(value).trim();
    if (!normalized) {
      return undefined;
    }
    return normalized
      .split(/[;,]/)
      .map(item => item.trim())
      .filter(Boolean);
  }

  private parseCsvBoolean(value: unknown): boolean | undefined {
    if (value === undefined || value === null || value === '') {
      return undefined;
    }
    if (typeof value === 'boolean') {
      return value;
    }
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'y'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
    return undefined;
  }

  async assignToGroups(organizationId: string, contactId: string, groupIds: string[]) {
    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
      relations: ['groups'],
    });

    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    if (!groupIds.length) {
      contact.groups = [];
      return this.contactRepository.save(contact);
    }

    const groups = await this.groupRepository.find({
      where: { organization_id: organizationId, id: In(groupIds) },
    });

    if (groups.length !== groupIds.length) {
      throw new NotFoundException('One or more groups not found');
    }

    contact.groups = groups;
    return this.contactRepository.save(contact);
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private generateOpaqueToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashOpaqueToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private normalizeImportRow(row: ContactImportInput): ContactImportInput {
    const nameFromLegacy = (row as any).name ? String((row as any).name).trim() : '';
    const rawFirstName = typeof row.first_name === 'string' ? row.first_name.trim() : row.first_name;
    const rawLastName = typeof row.last_name === 'string' ? row.last_name.trim() : row.last_name;

    let first_name = rawFirstName;
    let last_name = rawLastName;

    if (!first_name && nameFromLegacy) {
      const parts = nameFromLegacy.split(/\s+/).filter(Boolean);
      first_name = parts[0] || undefined;
      last_name = parts.slice(1).join(' ') || undefined;
    }

    return {
      first_name,
      middle_name: typeof row.middle_name === 'string' ? row.middle_name.trim() : row.middle_name,
      last_name,
      email: typeof row.email === 'string' ? this.normalizeEmail(row.email) : '',
      phone: typeof row.phone === 'string' ? row.phone.trim() : row.phone,
      gender: typeof row.gender === 'string' ? row.gender.trim() : row.gender,
      student_id: typeof row.student_id === 'string' ? row.student_id.trim() : row.student_id,
      external_id: typeof row.external_id === 'string' ? row.external_id.trim() : row.external_id,
      guardian_name: typeof row.guardian_name === 'string' ? row.guardian_name.trim() : row.guardian_name,
      guardian_email: typeof row.guardian_email === 'string' ? this.normalizeEmail(row.guardian_email) : row.guardian_email,
      guardian_phone: typeof row.guardian_phone === 'string' ? row.guardian_phone.trim() : row.guardian_phone,
      group_ids: this.uniqueStringList(row.group_ids),
      groups: this.uniqueStringList(row.groups)?.map(value => this.sanitizeGroupSegment(value)),
      group_paths: this.uniqueStringList(row.group_paths)?.map(value => this.sanitizeGroupPath(value)),
      require_login: row.require_login,
      is_active: row.is_active,
      must_reset_password: row.must_reset_password,
    };
  }

  private uniqueStringList(values?: string[]) {
    if (!values?.length) {
      return undefined;
    }

    const seen = new Set<string>();
    const output: string[] = [];
    for (const value of values) {
      if (!value) {
        continue;
      }
      const normalized = value.trim();
      if (!normalized) {
        continue;
      }
      if (!seen.has(normalized)) {
        seen.add(normalized);
        output.push(normalized);
      }
    }
    return output.length ? output : undefined;
  }

  private async resolveImportGroups(
    organizationId: string,
    row: ContactImportInput,
    groupById: Map<string, Group>,
    groupByKey: Map<string, Group>,
  ) {
    const selectedGroupIds = new Set<string>();

    for (const groupId of row.group_ids || []) {
      const group = groupById.get(groupId);
      if (!group) {
        throw new NotFoundException(`Group '${groupId}' not found for import row email '${row.email}'`);
      }
      selectedGroupIds.add(group.id);
    }

    const groupTokens = new Set<string>();
    for (const token of row.groups || []) {
      groupTokens.add(token);
    }
    for (const token of row.group_paths || []) {
      groupTokens.add(token);
    }

    for (const token of groupTokens) {
      const segments = this.parseGroupPathToken(token);
      if (!segments.length) {
        continue;
      }
      const group = await this.ensureGroupPath(organizationId, segments, groupById, groupByKey);
      selectedGroupIds.add(group.id);
    }

    return Array.from(selectedGroupIds).map(groupId => groupById.get(groupId)).filter(Boolean) as Group[];
  }

  private parseGroupPathToken(token: string) {
    if (!token) {
      return [];
    }

    return token
      .split('>')
      .map(segment => this.sanitizeGroupSegment(segment))
      .filter(Boolean);
  }

  private async ensureGroupPath(
    organizationId: string,
    segments: string[],
    groupById: Map<string, Group>,
    groupByKey: Map<string, Group>,
  ) {
    let parentGroup: Group | null = null;

    for (const segment of segments) {
      const normalizedSegment = this.sanitizeGroupSegment(segment);
      const key = this.buildGroupLookupKey(normalizedSegment, parentGroup?.id ?? null);
      const existing = groupByKey.get(key);
      if (existing) {
        const expectedParentId = parentGroup?.id ?? null;
        const actualParentId = existing.parent_group_id ?? null;
        if (expectedParentId !== actualParentId) {
          throw new BadRequestException(
            `Group '${normalizedSegment}' already exists under a different parent. Please rename the group or adjust the path.`,
          );
        }
        parentGroup = existing;
        continue;
      }

      const createdGroup = await this.groupRepository.save(
        this.groupRepository.create({
          organization_id: organizationId,
          name: normalizedSegment,
          parent_group_id: parentGroup?.id ?? null,
        }),
      );

      groupById.set(createdGroup.id, createdGroup);
      groupByKey.set(this.buildGroupLookupKey(createdGroup.name, createdGroup.parent_group_id), createdGroup);
      parentGroup = createdGroup;
    }

    if (!parentGroup) {
      throw new BadRequestException('Invalid group path');
    }

    return parentGroup;
  }

  private buildGroupLookupKey(name: string, parentGroupId?: string | null) {
    return `${parentGroupId ?? 'root'}:${this.sanitizeGroupSegment(name).toLowerCase()}`;
  }

  private sanitizeGroupPath(value: string) {
    return this.parseGroupPathToken(value).join(' > ');
  }

  private sanitizeGroupSegment(value: string) {
    return String(value || '')
      .trim()
      .replace(/\\"/g, '"')
      .replace(/^\"+|\"+$/g, '')
      .trim();
  }

  private buildGroupPathMap(groups: Group[]) {
    const byId = new Map(groups.map(group => [group.id, group]));
    const cache = new Map<string, string>();

    const resolvePath = (group: Group): string => {
      const cached = cache.get(group.id);
      if (cached) {
        return cached;
      }

      const parent = group.parent_group_id ? byId.get(group.parent_group_id) : undefined;
      const path = parent ? `${resolvePath(parent)} > ${group.name}` : group.name;
      cache.set(group.id, path);
      return path;
    };

    groups.forEach(group => {
      resolvePath(group);
    });

    return cache;
  }

  private escapeCsv(value: unknown) {
    const raw = String(value ?? '');
    const safeValue = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
    return `"${safeValue.replace(/"/g, '""')}"`;
  }
}
