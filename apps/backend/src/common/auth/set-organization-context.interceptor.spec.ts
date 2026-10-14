import { SetOrganizationContextInterceptor } from './set-organization-context.interceptor';

describe('SetOrganizationContextInterceptor', () => {
  const contextService = {
    setOrganizationContext: jest.fn(),
    setSystemContext: jest.fn(),
  };

  let interceptor: SetOrganizationContextInterceptor;

  const executionContext = (user: any) =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as any;

  const next = { handle: () => 'handled' } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    interceptor = new SetOrganizationContextInterceptor(contextService as any);
  });

  it('sets the organization context for authenticated tenant requests', () => {
    const result = interceptor.intercept(
      executionContext({ id: 'user-1', organization_id: 'org-1' }),
      next,
    );

    expect(contextService.setOrganizationContext).toHaveBeenCalledWith('org-1', 'user-1');
    expect(contextService.setSystemContext).not.toHaveBeenCalled();
    expect(result).toBe('handled');
  });

  it('sets the system context for public / unauthenticated requests', () => {
    interceptor.intercept(executionContext(undefined), next);

    expect(contextService.setSystemContext).toHaveBeenCalledTimes(1);
    expect(contextService.setOrganizationContext).not.toHaveBeenCalled();
  });

  it('sets the system context when the principal has no organization', () => {
    interceptor.intercept(executionContext({ id: 'user-2' }), next);

    expect(contextService.setSystemContext).toHaveBeenCalledTimes(1);
    expect(contextService.setOrganizationContext).not.toHaveBeenCalled();
  });
});
