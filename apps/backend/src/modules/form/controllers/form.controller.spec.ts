import { FormController } from './form.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

const mockFormService = () => ({
  create: jest.fn(),
  findByOrganization: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  addField: jest.fn(),
  updateField: jest.fn(),
  deleteField: jest.fn(),
  reorderFields: jest.fn(),
  assignToGroups: jest.fn(),
  getGroups: jest.fn(),
  getTargets: jest.fn(),
  assignTargets: jest.fn(),
  removeTarget: jest.fn(),
});

describe('FormController', () => {
  let formController: FormController;
  let formService: ReturnType<typeof mockFormService>;

  beforeEach(() => {
    formService = mockFormService();
    formController = new FormController(formService as any);
  });

  it('creates a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.create.mockResolvedValue({ id: 'form-1' });

    const result = await formController.createForm(req as any, {
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      allow_partial: false,
    } as any);

    expect(formService.create).toHaveBeenCalledWith('org-1', {
      title: 'Test',
      slug: 'test',
      payment_type: 'FIXED',
      allow_partial: false,
    });
    expect(result).toEqual({ id: 'form-1' });
  });

  it('lists forms', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.findByOrganization.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await formController.listForms(req as any, 1, 20);

    expect(formService.findByOrganization).toHaveBeenCalledWith('org-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('gets a form by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.findById.mockResolvedValue({ id: 'form-1' });

    const result = await formController.getForm(req as any, 'form-1');

    expect(formService.findById).toHaveBeenCalledWith('org-1', 'form-1');
    expect(result).toEqual({ id: 'form-1' });
  });

  it('updates a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.update.mockResolvedValue({ id: 'form-1', title: 'Updated' });

    const result = await formController.updateForm(req as any, 'form-1', { title: 'Updated' });

    expect(formService.update).toHaveBeenCalledWith('org-1', 'form-1', { title: 'Updated' });
    expect(result).toEqual({ id: 'form-1', title: 'Updated' });
  });

  it('deletes a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.delete.mockResolvedValue({ affected: 1 });

    const result = await formController.deleteForm(req as any, 'form-1');

    expect(formService.delete).toHaveBeenCalledWith('org-1', 'form-1');
    expect(result).toEqual({ affected: 1 });
  });

  it('adds a field', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.addField.mockResolvedValue({ id: 'field-1' });

    const result = await formController.addField(req as any, 'form-1', {
      label: 'Email',
      type: 'EMAIL',
      required: true,
    } as any);

    expect(formService.addField).toHaveBeenCalledWith('org-1', 'form-1', {
      label: 'Email',
      type: 'EMAIL',
      required: true,
    });
    expect(result).toEqual({ id: 'field-1' });
  });

  it('updates a field', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.updateField.mockResolvedValue({ id: 'field-1', label: 'Email' });

    const result = await formController.updateField(req as any, 'field-1', { label: 'Email' });

    expect(formService.updateField).toHaveBeenCalledWith('org-1', 'field-1', { label: 'Email' });
    expect(result).toEqual({ id: 'field-1', label: 'Email' });
  });

  it('deletes a field', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.deleteField.mockResolvedValue({ affected: 1 });

    const result = await formController.deleteField(req as any, 'field-1');

    expect(formService.deleteField).toHaveBeenCalledWith('org-1', 'field-1');
    expect(result).toEqual({ affected: 1 });
  });

  it('reorders fields', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.reorderFields.mockResolvedValue({ id: 'form-1' });

    const result = await formController.reorderFields(req as any, 'form-1', { fields: [{ id: 'field-1', order_index: 1 }] });

    expect(formService.reorderFields).toHaveBeenCalledWith('org-1', 'form-1', { fields: [{ id: 'field-1', order_index: 1 }] });
    expect(result).toEqual({ id: 'form-1' });
  });

  it('assigns a form to groups', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.assignToGroups.mockResolvedValue({ id: 'form-1' });

    const result = await formController.assignToGroups(req as any, 'form-1', { group_ids: ['group-1'] });

    expect(formService.assignToGroups).toHaveBeenCalledWith('org-1', 'form-1', ['group-1']);
    expect(result).toEqual({ id: 'form-1' });
  });

  it('gets groups for a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.getGroups.mockResolvedValue([{ id: 'group-1' }]);

    const result = await formController.getGroups(req as any, 'form-1');

    expect(formService.getGroups).toHaveBeenCalledWith('org-1', 'form-1');
    expect(result).toEqual([{ id: 'group-1' }]);
  });

  it('gets targets for a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.getTargets.mockResolvedValue([{ id: 'target-1' }]);

    const result = await formController.getTargets(req as any, 'form-1');

    expect(formService.getTargets).toHaveBeenCalledWith('org-1', 'form-1');
    expect(result).toEqual([{ id: 'target-1' }]);
  });

  it('assigns targets for a form', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.assignTargets.mockResolvedValue([{ id: 'target-1' }]);

    const result = await formController.assignTargets(req as any, 'form-1', { target_type: 'group', target_ids: ['group-1'] });

    expect(formService.assignTargets).toHaveBeenCalledWith('org-1', 'form-1', { target_type: 'group', target_ids: ['group-1'] });
    expect(result).toEqual([{ id: 'target-1' }]);
  });

  it('removes a target', async () => {
    const req = { user: { organization_id: 'org-1' } };
    formService.removeTarget.mockResolvedValue({ affected: 1 });

    const result = await formController.removeTarget(req as any, 'form-1', 'target-1');

    expect(formService.removeTarget).toHaveBeenCalledWith('org-1', 'form-1', 'target-1');
    expect(result).toEqual({ affected: 1 });
  });
});
