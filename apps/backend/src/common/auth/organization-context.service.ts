import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface OrganizationContext {
  organizationId: string | null;
  userId: string | null;
}

export interface RlsSettings {
  organizationId: string;
  bypass: boolean;
}

interface AsyncLocalStorageStore {
  organizationId: string | null;
  userId: string | null;
  /**
   * When true, the current execution is a system/public context (webhooks,
   * public forms, authentication bootstrap, background work) that is allowed to
   * cross tenant boundaries. When false, the execution is scoped to a single
   * tenant and Row Level Security restricts every query to that organization.
   */
  system: boolean;
}

@Injectable()
export class OrganizationContextService {
  private static storage = new AsyncLocalStorage<AsyncLocalStorageStore>();

  setOrganizationContext(organizationId: string, userId: string): void {
    const store: AsyncLocalStorageStore = {
      organizationId,
      userId,
      system: false,
    };
    OrganizationContextService.storage.enterWith(store);
  }

  /**
   * Marks the current execution as a system/public context. Queries executed in
   * this context are not restricted by Row Level Security.
   */
  setSystemContext(): void {
    const store: AsyncLocalStorageStore = {
      organizationId: null,
      userId: null,
      system: true,
    };
    OrganizationContextService.storage.enterWith(store);
  }

  getOrganizationId(): string | null {
    const store = OrganizationContextService.storage.getStore();
    return store?.organizationId ?? null;
  }

  getUserId(): string | null {
    const store = OrganizationContextService.storage.getStore();
    return store?.userId ?? null;
  }

  getContext(): OrganizationContext {
    const store = OrganizationContextService.storage.getStore();
    return {
      organizationId: store?.organizationId ?? null,
      userId: store?.userId ?? null,
    };
  }

  /**
   * Resolves the PostgreSQL GUC values that must be applied on the connection
   * before a query runs. Anything that is not an explicit tenant context (no
   * store, system context, or missing organization) is treated as a system
   * context so public endpoints and background work keep functioning.
   */
  getRlsSettings(): RlsSettings {
    const store = OrganizationContextService.storage.getStore();
    if (!store || store.system || !store.organizationId) {
      return { organizationId: '', bypass: true };
    }
    return { organizationId: store.organizationId, bypass: false };
  }

  runWithContext<T>(
    organizationId: string,
    userId: string,
    callback: () => T,
  ): T {
    const store: AsyncLocalStorageStore = {
      organizationId,
      userId,
      system: false,
    };
    return OrganizationContextService.storage.run(store, callback);
  }

  runWithoutContext<T>(callback: () => T): T {
    const store: AsyncLocalStorageStore = {
      organizationId: null,
      userId: null,
      system: true,
    };
    return OrganizationContextService.storage.run(store, callback);
  }

  static getStore(): AsyncLocalStorageStore | undefined {
    return OrganizationContextService.storage.getStore();
  }
}
