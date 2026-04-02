import { GroupController } from './group.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

const mockGroupService = () => ({
  create: jest.fn(),
  findByOrganization: jest.fn(),
  findTree: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addContacts: jest.fn(),
  getGroupContacts: jest.fn(),
});

describe('GroupController', () => {
  let groupController: GroupController;
  let groupService: ReturnType<typeof mockGroupService>;

  beforeEach(() => {
    groupService = mockGroupService();
    groupController = new GroupController(groupService as any);
  });

  it('creates a group', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.create.mockResolvedValue({ id: 'group-1' });

    const result = await groupController.createGroup(req as any, { name: 'Class A' });

    expect(groupService.create).toHaveBeenCalledWith('org-1', { name: 'Class A' });
    expect(result).toEqual({ id: 'group-1' });
  });

  it('lists groups', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.findByOrganization.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await groupController.listGroups(req as any, 1, 20);

    expect(groupService.findByOrganization).toHaveBeenCalledWith('org-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('returns tree groups', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.findTree.mockResolvedValue([{ id: 'root', children: [] }]);

    const result = await groupController.getGroupTree(req as any);

    expect(groupService.findTree).toHaveBeenCalledWith('org-1');
    expect(result).toEqual([{ id: 'root', children: [] }]);
  });

  it('gets a group by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.findById.mockResolvedValue({ id: 'group-1' });

    const result = await groupController.getGroup(req as any, 'group-1');

    expect(groupService.findById).toHaveBeenCalledWith('org-1', 'group-1');
    expect(result).toEqual({ id: 'group-1' });
  });

  it('updates a group', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.update.mockResolvedValue({ id: 'group-1', name: 'Class B' });

    const result = await groupController.updateGroup(req as any, 'group-1', { name: 'Class B' });

    expect(groupService.update).toHaveBeenCalledWith('org-1', 'group-1', { name: 'Class B' });
    expect(result).toEqual({ id: 'group-1', name: 'Class B' });
  });

  it('deletes a group', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.delete.mockResolvedValue({ affected: 1 });

    const result = await groupController.deleteGroup(req as any, 'group-1');

    expect(groupService.delete).toHaveBeenCalledWith('org-1', 'group-1');
    expect(result).toEqual({ affected: 1 });
  });

  it('adds contacts to a group', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.addContacts.mockResolvedValue({ id: 'group-1', contacts: ['contact-1'] });

    const result = await groupController.addContactsToGroup(req as any, 'group-1', { contact_ids: ['contact-1'] });

    expect(groupService.addContacts).toHaveBeenCalledWith('org-1', 'group-1', ['contact-1']);
    expect(result).toEqual({ id: 'group-1', contacts: ['contact-1'] });
  });

  it('gets group contacts', async () => {
    const req = { user: { organization_id: 'org-1' } };
    groupService.getGroupContacts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await groupController.getGroupContacts(req as any, 'group-1', 1, 20);

    expect(groupService.getGroupContacts).toHaveBeenCalledWith('org-1', 'group-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });
});
