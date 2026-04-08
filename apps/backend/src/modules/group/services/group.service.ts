import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Group } from '../entities/group.entity';
import { Contact } from '../../contact/entities/contact.entity';
import { CreateGroupDto, UpdateGroupDto } from '../dto/group.dto';

@Injectable()
export class GroupService {
  constructor(
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(Contact)
    private contactRepository: Repository<Contact>,
  ) {}

  async create(organizationId: string, dto: CreateGroupDto) {
    const payload = this.sanitizeGroupPayload(dto);
    const group = this.groupRepository.create({
      organization_id: organizationId,
      ...payload,
    });
    return this.groupRepository.save(group);
  }

  async findByOrganization(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.groupRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
    });

    const counts = await this.getContactCountsByGroupIds(organizationId, data.map(group => group.id));
    return {
      data: data.map(group => ({ ...group, contact_count: counts.get(group.id) || 0 })),
      total,
      page,
      limit,
    };
  }

  async findById(organizationId: string, id: string) {
    const group = await this.groupRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['contacts'],
    });

    if (!group) {
      return null;
    }

    const counts = await this.getContactCountsByGroupIds(organizationId, [group.id]);
    return { ...group, contact_count: counts.get(group.id) || 0 };
  }

  async update(organizationId: string, id: string, dto: UpdateGroupDto) {
    await this.groupRepository.update({ id, organization_id: organizationId }, this.sanitizeGroupPayload(dto));
    return this.findById(organizationId, id);
  }

  async delete(organizationId: string, id: string) {
    const group = await this.groupRepository.findOne({ where: { id, organization_id: organizationId } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const childCount = await this.groupRepository.count({
      where: { parent_group_id: id, organization_id: organizationId },
    });

    if (childCount > 0) {
      throw new BadRequestException('Group cannot be deleted while it has subgroups');
    }

    const contactCount = await this.contactRepository
      .createQueryBuilder('contact')
      .innerJoin('contact.groups', 'group', 'group.id = :groupId', { groupId: id })
      .where('contact.organization_id = :organizationId', { organizationId })
      .getCount();

    if (contactCount > 0) {
      throw new BadRequestException('Group cannot be deleted while it has contacts');
    }

    return this.groupRepository.delete({ id, organization_id: organizationId });
  }

  async findTree(organizationId: string) {
    const groups = await this.groupRepository.find({
      where: { organization_id: organizationId },
    });

    const counts = await this.getContactCountsByGroupIds(organizationId, groups.map(group => group.id));

    const groupMap = new Map<string, Group & { children: Group[]; contact_count: number }>();

    groups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [], contact_count: counts.get(group.id) || 0 });
    });

    const roots: Array<Group & { children: Group[]; contact_count: number }> = [];
    groupMap.forEach(group => {
      if (group.parent_group_id) {
        const parent = groupMap.get(group.parent_group_id);
        if (parent) {
          parent.children.push(group);
          return;
        }
      }
      roots.push(group);
    });

    return roots;
  }

  async addContacts(organizationId: string, groupId: string, contactIds: string[]) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, organization_id: organizationId },
      relations: ['contacts'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const contacts = await this.contactRepository.find({
      where: { organization_id: organizationId, id: In(contactIds) },
    });

    const uniqueContacts = new Map<string, Contact>();
    for (const contact of group.contacts || []) {
      uniqueContacts.set(contact.id, contact);
    }
    for (const contact of contacts) {
      uniqueContacts.set(contact.id, contact);
    }

    group.contacts = Array.from(uniqueContacts.values());
    return this.groupRepository.save(group);
  }

  async removeContacts(organizationId: string, groupId: string, contactIds: string[]) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, organization_id: organizationId },
      relations: ['contacts'],
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const contactIdSet = new Set(contactIds);
    group.contacts = (group.contacts || []).filter(contact => !contactIdSet.has(contact.id));
    await this.groupRepository.save(group);
    return this.findById(organizationId, groupId);
  }

  async detachFromParent(organizationId: string, id: string) {
    const group = await this.groupRepository.findOne({
      where: { id, organization_id: organizationId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    if (!group.parent_group_id) {
      return this.findById(organizationId, id);
    }

    await this.groupRepository.update({ id, organization_id: organizationId }, { parent_group_id: null });
    return this.findById(organizationId, id);
  }

  async getGroupContacts(organizationId: string, groupId: string, page: number = 1, limit: number = 20) {
    const group = await this.groupRepository.findOne({
      where: { id: groupId, organization_id: organizationId },
    });

    if (!group) {
      throw new NotFoundException('Group not found');
    }

    // Get all subgroup IDs recursively
    const allGroupIds = await this.getAllSubgroupIds(organizationId, groupId);
    allGroupIds.push(groupId); // Include the parent group itself

    const [contacts, total] = await this.contactRepository
      .createQueryBuilder('contact')
      .innerJoin('contact.groups', 'group', 'group.id IN (:...groupIds)', { groupIds: allGroupIds })
      .where('contact.organization_id = :organizationId', { organizationId })
      .distinct(true)
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: contacts, total, page, limit };
  }

  private async getContactCountsByGroupIds(organizationId: string, groupIds: string[]) {
    const counts = new Map<string, number>();

    if (!groupIds.length) {
      return counts;
    }

    const rows = await this.groupRepository
      .createQueryBuilder('group')
      .leftJoin('group.contacts', 'contact', 'contact.organization_id = :organizationId', { organizationId })
      .select('group.id', 'group_id')
      .addSelect('COUNT(DISTINCT contact.id)', 'contact_count')
      .where('group.organization_id = :organizationId', { organizationId })
      .andWhere('group.id IN (:...groupIds)', { groupIds })
      .groupBy('group.id')
      .getRawMany();

    for (const row of rows) {
      counts.set(row.group_id, Number(row.contact_count || 0));
    }

    return counts;
  }

  private sanitizeGroupPayload<T extends CreateGroupDto | UpdateGroupDto>(dto: T): T {
    const payload = { ...dto } as T;

    if (typeof payload.name === 'string') {
      payload.name = this.sanitizeGroupName(payload.name) as T['name'];
    }

    if (typeof payload.description === 'string') {
      payload.description = payload.description.trim() as T['description'];
    }

    if (typeof payload.note === 'string') {
      payload.note = payload.note.trim() as T['note'];
    }

    if (typeof payload.parent_group_id === 'string') {
      const normalizedParent = payload.parent_group_id.trim();
      payload.parent_group_id = (normalizedParent || undefined) as T['parent_group_id'];
    }

    return payload;
  }

  private sanitizeGroupName(value: string) {
    const normalized = value
      .trim()
      .replace(/\\"/g, '"')
      .replace(/^\"+|\"+$/g, '')
      .trim();

    if (!normalized) {
      throw new BadRequestException('Group name cannot be empty');
    }

    return normalized;
  }

  private async getAllSubgroupIds(organizationId: string, parentGroupId: string): Promise<string[]> {
    const subgroupIds: string[] = [];

    const subgroups = await this.groupRepository.find({
      where: { parent_group_id: parentGroupId, organization_id: organizationId },
      select: ['id'],
    });

    for (const subgroup of subgroups) {
      subgroupIds.push(subgroup.id);
      // Recursively get subgroups of subgroups
      const nestedSubgroupIds = await this.getAllSubgroupIds(organizationId, subgroup.id);
      subgroupIds.push(...nestedSubgroupIds);
    }

    return subgroupIds;
  }
}
