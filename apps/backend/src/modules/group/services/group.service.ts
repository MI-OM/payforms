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
    const group = this.groupRepository.create({
      organization_id: organizationId,
      ...dto,
    });
    return this.groupRepository.save(group);
  }

  async findByOrganization(organizationId: string, page: number = 1, limit: number = 20) {
    const [data, total] = await this.groupRepository.findAndCount({
      where: { organization_id: organizationId },
      skip: (page - 1) * limit,
      take: limit,
      relations: ['contacts'],
    });
    return { data, total, page, limit };
  }

  async findById(organizationId: string, id: string) {
    return this.groupRepository.findOne({
      where: { id, organization_id: organizationId },
      relations: ['contacts'],
    });
  }

  async update(organizationId: string, id: string, dto: UpdateGroupDto) {
    await this.groupRepository.update({ id, organization_id: organizationId }, dto);
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

    const groupMap = new Map<string, Group & { children: Group[] }>();

    groups.forEach(group => {
      groupMap.set(group.id, { ...group, children: [] });
    });

    const roots: Array<Group & { children: Group[] }> = [];
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

    group.contacts = [...(group.contacts || []), ...contacts];
    return this.groupRepository.save(group);
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
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return { data: contacts, total, page, limit };
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
