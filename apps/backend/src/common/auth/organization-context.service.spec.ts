import { OrganizationContextService } from './organization-context.service';

describe('OrganizationContextService', () => {
  let service: OrganizationContextService;

  beforeEach(() => {
    service = new OrganizationContextService();
  });

  it('returns tenant scoped RLS settings inside an organization context', () => {
    const settings = service.runWithContext('org-1', 'user-1', () =>
      service.getRlsSettings(),
    );

    expect(settings).toEqual({ organizationId: 'org-1', bypass: false });
  });

  it('returns bypass RLS settings in a system context', () => {
    const settings = service.runWithoutContext(() => service.getRlsSettings());

    expect(settings).toEqual({ organizationId: '', bypass: true });
  });

  it('returns bypass RLS settings when no context is available', () => {
    // A fresh service instance with no run/enterWith still resolves to system.
    expect(service.runWithoutContext(() => service.getRlsSettings())).toEqual({
      organizationId: '',
      bypass: true,
    });
  });

  it('treats an explicitly set organization as tenant scoped', () => {
    const settings = service.runWithoutContext(() => {
      service.setOrganizationContext('org-2', 'user-2');
      return service.getRlsSettings();
    });

    expect(settings).toEqual({ organizationId: 'org-2', bypass: false });
  });

  it('treats an explicitly set system context as bypass', () => {
    const settings = service.runWithContext('org-3', 'user-3', () => {
      service.setSystemContext();
      return service.getRlsSettings();
    });

    expect(settings).toEqual({ organizationId: '', bypass: true });
  });

  it('exposes the current context', () => {
    const context = service.runWithContext('org-4', 'user-4', () => service.getContext());

    expect(context).toEqual({ organizationId: 'org-4', userId: 'user-4' });
  });

  it('keeps the organization context across async boundaries after setOrganizationContext', async () => {
    // The interceptor calls setOrganizationContext (which uses AsyncLocalStorage
    // enterWith) and the handler then performs awaited database work. This
    // asserts the context survives that await, which is what allows the RLS
    // query runner to observe the tenant for the whole request.
    await service.runWithoutContext(async () => {
      service.setOrganizationContext('org-9', 'user-9');
      await Promise.resolve();

      expect(service.getRlsSettings()).toEqual({
        organizationId: 'org-9',
        bypass: false,
      });
    });
  });
});
