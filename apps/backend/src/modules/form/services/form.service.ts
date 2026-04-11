import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Form } from '../entities/form.entity';
import { FormField } from '../entities/form-field.entity';
import { FormTarget } from '../entities/form-target.entity';
import { Group } from '../../group/entities/group.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { CreateFormDto, UpdateFormDto, CreateFormFieldDto, UpdateFormFieldDto, ReorderFieldsDto, AssignFormTargetsDto } from '../dto/form.dto';
import { RedisCacheService } from '../../../common/cache/redis-cache.service';

@Injectable()
export class FormService {
  private static readonly PUBLIC_FORM_CACHE_TTL_SECONDS = 120;

  constructor(
    @InjectRepository(Form)
    private formRepository: Repository<Form>,
    @InjectRepository(FormField)
    private fieldRepository: Repository<FormField>,
    @InjectRepository(FormTarget)
    private targetRepository: Repository<FormTarget>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
    private cacheService: RedisCacheService,
  ) {}

  async create(organizationId: string, dto: CreateFormDto) {
    const form = this.formRepository.create({
      organization_id: organizationId,
      ...dto,
    });
    const savedForm = await this.formRepository.save(form);
    await this.invalidatePublicFormCaches([savedForm.slug]);
    return savedForm;
  }

  async findByOrganization(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.formRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['fields', 'groups'],
      order: { created_at: 'DESC' },
    });
    return { data, total, page, limit };
  }

  async findAccessibleByContact(
    organizationId: string,
    contactId: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const safePage = Number.isFinite(Number(page)) && Number(page) > 0 ? Number(page) : 1;
    const safeLimit = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Number(limit), 100) : 20;

    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: organizationId },
      relations: ['groups'],
    });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    const forms = await this.formRepository.find({
      where: { organization_id: organizationId, is_active: true },
      relations: ['targets'],
      order: { created_at: 'DESC' },
    });

    const contactGroupIds = new Set((contact.groups || []).map(group => group.id));
    const targetGroupDescendantsCache = new Map<string, string[]>();

    const accessibleForms: Form[] = [];

    for (const form of forms) {
      if (!form.targets?.length) {
        accessibleForms.push(form);
        continue;
      }

      const directContactTarget = form.targets.some(
        target => target.target_type === 'contact' && target.target_id === contactId,
      );
      if (directContactTarget) {
        accessibleForms.push(form);
        continue;
      }

      const targetedGroupIds = form.targets
        .filter(target => target.target_type === 'group')
        .map(target => target.target_id);

      let hasGroupAccess = false;
      for (const targetedGroupId of targetedGroupIds) {
        let descendants = targetGroupDescendantsCache.get(targetedGroupId);
        if (!descendants) {
          descendants = await this.getGroupAndDescendantIds(organizationId, targetedGroupId);
          targetGroupDescendantsCache.set(targetedGroupId, descendants);
        }

        if (descendants.some(groupId => contactGroupIds.has(groupId))) {
          hasGroupAccess = true;
          break;
        }
      }

      if (hasGroupAccess) {
        accessibleForms.push(form);
      }
    }

    const start = (safePage - 1) * safeLimit;
    const paged = accessibleForms.slice(start, start + safeLimit).map(form => this.mapContactAccessibleForm(form));

    return {
      data: paged,
      total: accessibleForms.length,
      page: safePage,
      limit: safeLimit,
    };
  }

  async findById(organizationId: string, id: string) {
    return this.formRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['fields', 'groups'],
    });
  }

  async findBySlug(slug: string) {
    const cacheKey = this.getPublicFormCacheKey(slug);
    const cached = await this.cacheService.get<Form>(cacheKey);
    if (cached) {
      return cached;
    }

    const form = await this.formRepository.findOne({
      where: { slug, is_active: true },
      relations: ['fields', 'organization', 'targets'],
      select: {
        organization: {
          id: true,
          require_contact_login: true,
        }
      }
    });

    if (form) {
      await this.cacheService.set(cacheKey, form, FormService.PUBLIC_FORM_CACHE_TTL_SECONDS);
    }

    return form;
  }

  async getTargets(organizationId: string, formId: string) {
    const form = await this.findById(organizationId, formId);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    return this.targetRepository.find({
      where: { form_id: formId },
      order: { created_at: 'ASC' },
    });
  }

  async assignTargets(organizationId: string, formId: string, dto: AssignFormTargetsDto) {
    const form = await this.findById(organizationId, formId);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    if (dto.target_type === 'group') {
      const groups = await this.groupRepository.find({
        where: { organization_id: organizationId, id: In(dto.target_ids) },
      });
      if (groups.length !== dto.target_ids.length) {
        throw new NotFoundException('One or more groups not found');
      }
    } else {
      const contacts = await this.contactRepository.find({
        where: { organization_id: organizationId, id: In(dto.target_ids) },
      });
      if (contacts.length !== dto.target_ids.length) {
        throw new NotFoundException('One or more contacts not found');
      }
    }

    const existing = await this.targetRepository.find({
      where: { form_id: formId, target_type: dto.target_type, target_id: In(dto.target_ids) },
    });

    const existingIds = existing.map(target => target.target_id);
    const newTargets = dto.target_ids
      .filter(id => !existingIds.includes(id))
      .map(target_id =>
        this.targetRepository.create({
          form_id: formId,
          target_type: dto.target_type,
          target_id,
        }),
      );

    if (newTargets.length) {
      await this.targetRepository.save(newTargets);
    }

    await this.invalidatePublicFormCaches([form.slug]);
    return this.getTargets(organizationId, formId);
  }

  async removeTarget(organizationId: string, formId: string, targetId: string) {
    const form = await this.findById(organizationId, formId);
    if (!form) {
      throw new NotFoundException('Form not found');
    }

    const target = await this.targetRepository.findOne({
      where: { id: targetId, form_id: formId },
    });
    if (!target) {
      throw new NotFoundException('Target not found');
    }

    const result = await this.targetRepository.delete({ id: targetId });
    await this.invalidatePublicFormCaches([form.slug]);
    return result;
  }

  async getTargetContactIds(organizationId: string, formId: string) {
    const targets = await this.targetRepository.find({ where: { form_id: formId } });
    if (!targets.length) {
      return [];
    }

    const contactIds = new Set<string>();
    const groupIds = targets.filter(t => t.target_type === 'group').map(t => t.target_id);

    for (const groupId of groupIds) {
      const groupIdsWithChildren = await this.getGroupAndDescendantIds(organizationId, groupId);
      if (groupIdsWithChildren.length) {
        const contacts = await this.contactRepository
          .createQueryBuilder('contact')
          .innerJoin('contact.groups', 'group')
          .where('contact.organization_id = :organizationId', { organizationId })
          .andWhere('group.id IN (:...groupIds)', { groupIds: groupIdsWithChildren })
          .select(['contact.id'])
          .getMany();

        contacts.forEach(contact => contactIds.add(contact.id));
      }
    }

    targets
      .filter(t => t.target_type === 'contact')
      .forEach(t => contactIds.add(t.target_id));

    return Array.from(contactIds);
  }

  async isContactEligible(form: Form, contactId: string): Promise<boolean> {
    if (!form.targets?.length) {
      return true;
    }

    if (!contactId) {
      return false;
    }

    const directTarget = form.targets.some(
      target => target.target_type === 'contact' && target.target_id === contactId,
    );
    if (directTarget) {
      return true;
    }

    const targetGroupIds = form.targets
      .filter(target => target.target_type === 'group')
      .map(target => target.target_id);

    if (!targetGroupIds.length) {
      return false;
    }

    const contact = await this.contactRepository.findOne({
      where: { id: contactId, organization_id: form.organization_id },
      relations: ['groups'],
    });

    if (!contact) {
      return false;
    }

    const contactGroupIds = (contact.groups || []).map(group => group.id);
    for (const groupId of targetGroupIds) {
      const groupIdsWithChildren = await this.getGroupAndDescendantIds(form.organization_id, groupId);
      if (groupIdsWithChildren.some(id => contactGroupIds.includes(id))) {
        return true;
      }
    }

    return false;
  }

  private async getGroupAndDescendantIds(organizationId: string, groupId: string, found: string[] = []) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, organization_id: organizationId },
    });
    if (!group) {
      return found;
    }

    found.push(group.id);

    const children = await this.groupRepository.find({
      where: { parent_group_id: group.id, organization_id: organizationId },
    });

    for (const child of children) {
      if (!found.includes(child.id)) {
        await this.getGroupAndDescendantIds(organizationId, child.id, found);
      }
    }

    return found;
  }

  private mapContactAccessibleForm(form: Form) {
    return {
      id: form.id,
      title: form.title,
      category: form.category,
      description: form.description,
      note: form.note,
      slug: form.slug,
      payment_type: form.payment_type,
      amount: form.amount,
      allow_partial: form.allow_partial,
      access_mode: form.access_mode ?? 'OPEN',
      identity_validation_mode: form.identity_validation_mode ?? 'NONE',
      identity_field_label: form.identity_field_label ?? null,
      is_targeted: !!form.targets?.length,
      created_at: form.created_at,
    };
  }

  async update(organizationId: string, id: string, dto: UpdateFormDto) {
    const previousSlug = await this.getFormSlugById(organizationId, id);
    await this.formRepository.update({ id, organization_id: organizationId }, dto);
    const updatedForm = await this.findById(organizationId, id);
    await this.invalidatePublicFormCaches([previousSlug, updatedForm?.slug]);
    return updatedForm;
  }

  async delete(organizationId: string, id: string) {
    const previousSlug = await this.getFormSlugById(organizationId, id);
    const result = await this.formRepository.delete({ id, organization_id: organizationId });
    await this.invalidatePublicFormCaches([previousSlug]);
    return result;
  }

  async addField(organizationId: string, formId: string, dto: CreateFormFieldDto) {
    const form = await this.findById(organizationId, formId);
    if (!form) throw new NotFoundException('Form not found');

    const field = this.fieldRepository.create({
      form_id: formId,
      ...dto,
      order_index: dto.order_index ?? (form.fields?.length || 0) + 1,
    });
    const savedField = await this.fieldRepository.save(field);
    await this.invalidatePublicFormCaches([form.slug]);
    return savedField;
  }

  private async findFieldByOrganization(organizationId: string, fieldId: string) {
    const field = await this.fieldRepository.findOne({
      where: { id: fieldId },
      relations: ['form'],
    });

    if (!field || field.form.organization_id !== organizationId) {
      return null;
    }

    return field;
  }

  async updateField(organizationId: string, fieldId: string, dto: UpdateFormFieldDto) {
    const field = await this.findFieldByOrganization(organizationId, fieldId);
    if (!field) throw new NotFoundException('Field not found');

    await this.fieldRepository.update({ id: fieldId, form_id: field.form_id }, dto);
    const updatedField = await this.fieldRepository.findOne({ where: { id: fieldId } });
    await this.invalidatePublicFormCaches([field.form.slug]);
    return updatedField;
  }

  async deleteField(organizationId: string, fieldId: string) {
    const field = await this.findFieldByOrganization(organizationId, fieldId);
    if (!field) throw new NotFoundException('Field not found');
    const result = await this.fieldRepository.delete({ id: fieldId, form_id: field.form_id });
    await this.invalidatePublicFormCaches([field.form.slug]);
    return result;
  }

  async reorderFields(organizationId: string, formId: string, dto: ReorderFieldsDto) {
    const form = await this.findById(organizationId, formId);
    if (!form) throw new NotFoundException('Form not found');

    for (const field of dto.fields) {
      await this.fieldRepository.update({ id: field.id, form_id: formId }, { order_index: field.order_index });
    }

    await this.invalidatePublicFormCaches([form.slug]);
    return this.findById(organizationId, formId);
  }

  async assignToGroups(organizationId: string, formId: string, groupIds: string[]) {
    const form = await this.findById(organizationId, formId);
    if (!form) throw new NotFoundException('Form not found');

    const groups = await this.groupRepository.find({
      where: { organization_id: organizationId, id: In(groupIds) },
    });

    if (groups.length !== groupIds.length) {
      throw new NotFoundException('One or more groups not found');
    }

    form.groups = groups;
    const updatedForm = await this.formRepository.save(form);
    await this.invalidatePublicFormCaches([form.slug]);
    return updatedForm;
  }

  async getGroups(organizationId: string, formId: string) {
    const form = await this.formRepository.findOne({
      where: { id: formId, organization_id: organizationId },
      relations: ['groups'],
    });
    return form?.groups || [];
  }

  private getPublicFormCacheKey(slug: string) {
    return `public_form:${slug}`;
  }

  private async invalidatePublicFormCaches(slugs: Array<string | null | undefined>) {
    const validSlugs = Array.from(new Set(slugs.filter((slug): slug is string => !!slug)));
    await Promise.all(
      validSlugs.map(slug => this.cacheService.del(this.getPublicFormCacheKey(slug))),
    );
  }

  private async getFormSlugById(organizationId: string, formId: string) {
    const form = await this.formRepository.findOne({
      where: { id: formId, organization_id: organizationId },
      select: ['slug'],
    });

    return form?.slug ?? null;
  }
}
