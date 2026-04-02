import { NotFoundException, BadRequestException } from '@nestjs/common';
import { GroupService } from './services/group.service';
import { Group } from './entities/group.entity';
import { Contact } from '../contact/entities/contact.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findAndCount: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('GroupService', () => {
  let groupService: GroupService;
  let groupRepository: MockRepository;
  let contactRepository: MockRepository;
  let queryBuilder: any;

  beforeEach(() => {
    groupRepository = createMockRepository();
    contactRepository = createMockRepository();
    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn(),
      getManyAndCount: jest.fn(),
    };

    contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    groupService = new GroupService(groupRepository as any, contactRepository as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a group', async () => {
    const dto = { name: 'Class A', description: 'Test group' };
    const savedGroup = { id: 'group-1', ...dto, organization_id: 'org-1' } as Group;

    groupRepository.create.mockReturnValue({ organization_id: 'org-1', ...dto });
    groupRepository.save.mockResolvedValue(savedGroup);

    const result = await groupService.create('org-1', dto);

    expect(groupRepository.create).toHaveBeenCalledWith({ organization_id: 'org-1', ...dto });
    expect(result).toEqual(savedGroup);
  });

  it('lists groups with pagination', async () => {
    const groups = [{ id: 'group-1' }];
    groupRepository.findAndCount.mockResolvedValue([groups, 1]);

    const result = await groupService.findByOrganization('org-1', 2, 10);

    expect(groupRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      skip: 10,
      take: 10,
      relations: ['contacts'],
    });
    expect(result).toEqual({ data: groups, total: 1, page: 2, limit: 10 });
  });

  it('returns group by id', async () => {
    const group = { id: 'group-1' } as Group;
    groupRepository.findOne.mockResolvedValue(group);

    const result = await groupService.findById('org-1', 'group-1');

    expect(groupRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'group-1', organization_id: 'org-1' },
      relations: ['contacts'],
    });
    expect(result).toEqual(group);
  });

  it('updates a group and returns updated value', async () => {
    const updatedGroup = { id: 'group-1', name: 'Class B' } as Group;
    groupRepository.update.mockResolvedValue(undefined);
    groupRepository.findOne.mockResolvedValue(updatedGroup);

    const result = await groupService.update('org-1', 'group-1', { name: 'Class B' });

    expect(groupRepository.update).toHaveBeenCalledWith(
      { id: 'group-1', organization_id: 'org-1' },
      { name: 'Class B' },
    );
    expect(result).toEqual(updatedGroup);
  });

  it('throws NotFoundException when deleting missing group', async () => {
    groupRepository.findOne.mockResolvedValue(null);

    await expect(groupService.delete('org-1', 'group-1')).rejects.toThrow(NotFoundException);
  });

  it('throws BadRequestException when deleting group with subgroups', async () => {
    groupRepository.findOne.mockResolvedValue({ id: 'group-1' } as Group);
    groupRepository.count.mockResolvedValue(1);

    await expect(groupService.delete('org-1', 'group-1')).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when deleting group with contacts', async () => {
    groupRepository.findOne.mockResolvedValue({ id: 'group-1' } as Group);
    groupRepository.count.mockResolvedValue(0);
    queryBuilder.getCount.mockResolvedValue(3);

    await expect(groupService.delete('org-1', 'group-1')).rejects.toThrow(BadRequestException);
  });

  it('deletes a group successfully', async () => {
    groupRepository.findOne.mockResolvedValue({ id: 'group-1' } as Group);
    groupRepository.count.mockResolvedValue(0);
    queryBuilder.getCount.mockResolvedValue(0);
    groupRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await groupService.delete('org-1', 'group-1');

    expect(groupRepository.delete).toHaveBeenCalledWith({ id: 'group-1', organization_id: 'org-1' });
    expect(result).toEqual({ affected: 1 });
  });

  it('returns a group tree', async () => {
    const groups = [
      { id: 'root', parent_group_id: null } as Group,
      { id: 'child', parent_group_id: 'root' } as Group,
    ];
    groupRepository.find.mockResolvedValue(groups);

    const result = await groupService.findTree('org-1');

    expect(result).toHaveLength(1);
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children[0]).toEqual({
      id: 'child',
      parent_group_id: 'root',
      children: [],
    });
  });

  it('adds contacts to group', async () => {
    const group = {
      id: 'group-1',
      organization_id: 'org-1',
      name: 'Class A',
      description: null,
      parent_group_id: null,
      contacts: [],
    } as unknown as Group;
    const contacts = [{ id: 'contact-1' }, { id: 'contact-2' }] as Contact[];

    groupRepository.findOne.mockResolvedValue(group);
    contactRepository.find.mockResolvedValue(contacts);
    groupRepository.save.mockResolvedValue({ ...group, contacts });

    const result = await groupService.addContacts('org-1', 'group-1', ['contact-1', 'contact-2']);

    expect(groupRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'group-1', organization_id: 'org-1' },
      relations: ['contacts'],
    });
    expect(contactRepository.find).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', id: expect.any(Object) },
    });
    expect(result).toEqual({ ...group, contacts });
  });

  it('throws NotFoundException when adding contacts to missing group', async () => {
    groupRepository.findOne.mockResolvedValue(null);

    await expect(groupService.addContacts('org-1', 'group-1', ['contact-1'])).rejects.toThrow(NotFoundException);
  });

  it('returns paged group contacts', async () => {
    const group = { id: 'group-1' } as Group;
    const contacts = [{ id: 'contact-1' }];

    groupRepository.findOne.mockResolvedValue(group);
    queryBuilder.getManyAndCount.mockResolvedValue([contacts, 1]);

    const result = await groupService.getGroupContacts('org-1', 'group-1', 1, 10);

    expect(groupRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'group-1', organization_id: 'org-1' },
    });
    expect(result).toEqual({ data: contacts, total: 1, page: 1, limit: 10 });
  });

  it('throws NotFoundException when getting contacts for missing group', async () => {
    groupRepository.findOne.mockResolvedValue(null);

    await expect(groupService.getGroupContacts('org-1', 'group-1', 1, 10)).rejects.toThrow(NotFoundException);
  });
});
