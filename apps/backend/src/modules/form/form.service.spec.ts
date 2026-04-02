import { NotFoundException } from '@nestjs/common';
import { FormService } from './services/form.service';
import { Form } from './entities/form.entity';
import { FormField } from './entities/form-field.entity';
import { FormTarget } from './entities/form-target.entity';
import { Group } from '../group/entities/group.entity';
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
  delete: jest.fn(),
  find: jest.fn(),
  count: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('FormService', () => {
  let formService: FormService;
  let formRepository: MockRepository;
  let fieldRepository: MockRepository;
  let targetRepository: MockRepository;
  let groupRepository: MockRepository;
  let contactRepository: MockRepository;
  let cacheService: { get: any; set: any; del: any; delByPrefix: any };
  let queryBuilder: any;

  beforeEach(() => {
    formRepository = createMockRepository();
    fieldRepository = createMockRepository();
    targetRepository = createMockRepository();
    groupRepository = createMockRepository();
    contactRepository = createMockRepository();
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      delByPrefix: jest.fn(),
    };

    queryBuilder = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      getMany: jest.fn(),
      getManyAndCount: jest.fn(),
    };
    contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    formService = new FormService(
      formRepository as any,
      fieldRepository as any,
      targetRepository as any,
      groupRepository as any,
      contactRepository as any,
      cacheService as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a new form', async () => {
    const dto = { title: 'Test', slug: 'test', payment_type: 'FIXED', allow_partial: false };
    const savedForm = { id: 'form-1', organization_id: 'org-1', ...dto } as Form;

    formRepository.create.mockReturnValue({ organization_id: 'org-1', ...dto });
    formRepository.save.mockResolvedValue(savedForm);

    const result = await formService.create('org-1', dto as any);

    expect(formRepository.create).toHaveBeenCalledWith({ organization_id: 'org-1', ...dto });
    expect(result).toEqual(savedForm);
  });

  it('finds forms by organization with pagination', async () => {
    const forms = [{ id: 'form-1' }];
    formRepository.findAndCount.mockResolvedValue([forms, 1]);

    const result = await formService.findByOrganization('org-1', 2, 5);

    expect(formRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      skip: 5,
      take: 5,
      relations: ['fields', 'groups'],
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual({ data: forms, total: 1, page: 2, limit: 5 });
  });

  it('returns a form by id', async () => {
    const form = { id: 'form-1' } as Form;
    formRepository.findOne.mockResolvedValue(form);

    const result = await formService.findById('org-1', 'form-1');

    expect(formRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'form-1', organization_id: 'org-1' },
      relations: ['fields', 'groups'],
    });
    expect(result).toEqual(form);
  });

  it('caches public form lookup by slug', async () => {
    const form = { id: 'form-1', slug: 'test', is_active: true, fields: [], targets: [] } as unknown as Form;
    cacheService.get.mockResolvedValue(null);
    formRepository.findOne.mockResolvedValue(form);

    const result = await formService.findBySlug('test');

    expect(cacheService.get).toHaveBeenCalledWith('public_form:test');
    expect(cacheService.set).toHaveBeenCalled();
    expect(result).toEqual(form);
  });

  it('gets form targets', async () => {
    formRepository.findOne.mockResolvedValue({ id: 'form-1' } as Form);
    const targets = [{ id: 'target-1' }];
    targetRepository.find.mockResolvedValue(targets);

    const result = await formService.getTargets('org-1', 'form-1');

    expect(result).toEqual(targets);
    expect(targetRepository.find).toHaveBeenCalledWith({ where: { form_id: 'form-1' }, order: { created_at: 'ASC' } });
  });

  it('throws NotFoundException when getting targets for missing form', async () => {
    formRepository.findOne.mockResolvedValue(null);

    await expect(formService.getTargets('org-1', 'form-1')).rejects.toThrow(NotFoundException);
  });

  it('assigns group targets successfully', async () => {
    formRepository.findOne.mockResolvedValue({ id: 'form-1' } as Form);
    groupRepository.find.mockResolvedValue([{ id: 'group-1' }]);
    targetRepository.find.mockResolvedValue([]);
    targetRepository.create.mockImplementation(dto => dto);
    targetRepository.save.mockResolvedValue([{ target_id: 'group-1' }]);
    targetRepository.find.mockResolvedValueOnce([]).mockResolvedValueOnce([{ target_id: 'group-1' }]);

    const result = await formService.assignTargets('org-1', 'form-1', {
      target_type: 'group',
      target_ids: ['group-1'],
    });

    expect(result).toEqual([{ target_id: 'group-1' }]);
  });

  it('throws NotFoundException when assigning targets with missing group', async () => {
    formRepository.findOne.mockResolvedValue({ id: 'form-1' } as Form);
    groupRepository.find.mockResolvedValue([]);

    await expect(
      formService.assignTargets('org-1', 'form-1', {
        target_type: 'group',
        target_ids: ['group-1'],
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('removes a target successfully', async () => {
    formRepository.findOne.mockResolvedValue({ id: 'form-1' } as Form);
    targetRepository.findOne.mockResolvedValue({ id: 'target-1' });
    targetRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await formService.removeTarget('org-1', 'form-1', 'target-1');

    expect(targetRepository.delete).toHaveBeenCalledWith({ id: 'target-1' });
    expect(result).toEqual({ affected: 1 });
  });

  it('throws NotFoundException when removing missing target', async () => {
    formRepository.findOne.mockResolvedValue({ id: 'form-1' } as Form);
    targetRepository.findOne.mockResolvedValue(null);

    await expect(formService.removeTarget('org-1', 'form-1', 'target-1')).rejects.toThrow(NotFoundException);
  });

  it('determines eligibility by direct contact target', async () => {
    const form = {
      organization_id: 'org-1',
      targets: [{ target_type: 'contact', target_id: 'contact-1' }],
    } as unknown as Form;

    const result = await formService.isContactEligible(form, 'contact-1');

    expect(result).toBe(true);
  });

  it('determines eligibility by group membership', async () => {
    const form = {
      organization_id: 'org-1',
      targets: [{ target_type: 'group', target_id: 'group-1' }],
    } as unknown as Form;
    contactRepository.findOne.mockResolvedValue({
      id: 'contact-1',
      groups: [{ id: 'group-1' }],
    } as Contact);
    groupRepository.findOne.mockResolvedValue({ id: 'group-1' } as Group);
    groupRepository.find.mockResolvedValue([]);

    const result = await formService.isContactEligible(form, 'contact-1');

    expect(result).toBe(true);
  });

  it('determines eligibility by subgroup membership through descendant groups', async () => {
    const form = {
      organization_id: 'org-1',
      targets: [{ target_type: 'group', target_id: 'group-1' }],
    } as unknown as Form;
    contactRepository.findOne.mockResolvedValue({
      id: 'contact-1',
      groups: [{ id: 'subgroup-1' }],
    } as Contact);
    groupRepository.findOne
      .mockResolvedValueOnce({ id: 'group-1' } as Group)
      .mockResolvedValueOnce({ id: 'subgroup-1', parent_group_id: 'group-1' } as Group);
    groupRepository.find.mockResolvedValueOnce([
      { id: 'subgroup-1', parent_group_id: 'group-1' } as Group,
    ]).mockResolvedValueOnce([]);

    const result = await formService.isContactEligible(form, 'contact-1');

    expect(result).toBe(true);
  });

  it('fetches target contact ids including subgroup members and direct contacts', async () => {
    targetRepository.find.mockResolvedValue([
      { target_type: 'group', target_id: 'group-1' },
      { target_type: 'contact', target_id: 'contact-2' },
    ]);
    groupRepository.findOne.mockResolvedValue({ id: 'group-1' } as Group);
    groupRepository.find.mockResolvedValueOnce([
      { id: 'subgroup-1', parent_group_id: 'group-1' } as Group,
    ]).mockResolvedValueOnce([]);
    queryBuilder.getMany.mockResolvedValue([{ id: 'contact-1' }]);

    const result = await formService.getTargetContactIds('org-1', 'form-1');

    expect(result.sort()).toEqual(['contact-1', 'contact-2'].sort());
  });

  it('adds a field to a form', async () => {
    const form = {
      id: 'form-1',
      organization_id: 'org-1',
      title: 'Test Form',
      slug: 'test-form',
      payment_type: 'FIXED',
      allow_partial: false,
      fields: [],
    } as unknown as Form;
    formRepository.findOne.mockResolvedValue(form);
    fieldRepository.create.mockReturnValue({ form_id: 'form-1', label: 'Email' });
    fieldRepository.save.mockResolvedValue({ id: 'field-1', label: 'Email' });

    const result = await formService.addField('org-1', 'form-1', { label: 'Email', type: 'EMAIL', required: true } as any);

    expect(fieldRepository.create).toHaveBeenCalledWith({
      form_id: 'form-1',
      label: 'Email',
      type: 'EMAIL',
      required: true,
      order_index: 1,
    });
    expect(result).toEqual({ id: 'field-1', label: 'Email' });
  });
});
