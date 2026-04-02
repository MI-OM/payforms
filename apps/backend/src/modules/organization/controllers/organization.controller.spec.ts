import { OrganizationController } from './organization.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockOrganizationService = ReturnType<typeof mockOrganizationService>;

const mockOrganizationService = () => ({
  findById: jest.fn(),
  update: jest.fn(),
  getSettings: jest.fn(),
  updatePaystackKeys: jest.fn(),
  uploadLogo: jest.fn(),
});

describe('OrganizationController', () => {
  let controller: OrganizationController;
  let service: MockOrganizationService;

  beforeEach(() => {
    service = mockOrganizationService();
    controller = new OrganizationController(service as any);
  });

  it('gets organization details', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.findById.mockResolvedValue({ id: 'org-1' });

    const result = await controller.getOrganization(req as any);

    expect(service.findById).toHaveBeenCalledWith('org-1');
    expect(result).toEqual({ id: 'org-1' });
  });

  it('updates organization', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { name: 'New Org' };
    service.update.mockResolvedValue({ id: 'org-1', ...dto });

    const result = await controller.updateOrganization(req as any, dto as any);

    expect(service.update).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual({ id: 'org-1', ...dto });
  });

  it('gets organization settings', async () => {
    const req = { user: { organization_id: 'org-1' } };
    service.getSettings.mockResolvedValue({ id: 'org-1', name: 'Org' });

    const result = await controller.getSettings(req as any);

    expect(service.getSettings).toHaveBeenCalledWith('org-1');
    expect(result).toEqual({ id: 'org-1', name: 'Org' });
  });

  it('updates settings', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { name: 'Updated Org' };
    service.update.mockResolvedValue({ id: 'org-1', ...dto });

    const result = await controller.updateSettings(req as any, dto as any);

    expect(service.update).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual({ id: 'org-1', ...dto });
  });

  it('updates paystack keys', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { paystack_public_key: 'pk_test', paystack_secret_key: 'sk_test' };
    service.updatePaystackKeys.mockResolvedValue({ id: 'org-1' });

    const result = await controller.updatePaystackKeys(req as any, dto as any);

    expect(service.updatePaystackKeys).toHaveBeenCalledWith('org-1', dto);
    expect(result).toEqual({ id: 'org-1' });
  });

  it('uploads a logo', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { logo_url: 'https://example.com/logo.png' };
    service.uploadLogo.mockResolvedValue({ id: 'org-1', logo_url: dto.logo_url });

    const result = await controller.uploadLogo(req as any, dto as any);

    expect(service.uploadLogo).toHaveBeenCalledWith('org-1', dto.logo_url);
    expect(result).toEqual({ id: 'org-1', logo_url: dto.logo_url });
  });
});
