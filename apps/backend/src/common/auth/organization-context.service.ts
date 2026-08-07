import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

export interface OrganizationContext {
  organizationId: string | null;
  userId: string | null;
}

interface AsyncLocalStorageStore {
  organizationId: string | null;
  userId: string | null;
}

@Injectable()
export class OrganizationContextService {
  private static storage = new AsyncLocalStorage<AsyncLocalStorageStore>();

  setOrganizationContext(organizationId: string, userId: string): void {
    const store: AsyncLocalStorageStore = {
      organizationId,
      userId,
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

  runWithContext<T>(
    organizationId: string,
    userId: string,
    callback: () => T,
  ): T {
    const store: AsyncLocalStorageStore = {
      organizationId,
      userId,
    };
    return OrganizationContextService.storage.run(store, callback);
  }

  runWithoutContext<T>(callback: () => T): T {
    const store: AsyncLocalStorageStore = {
      organizationId: null,
      userId: null,
    };
    return OrganizationContextService.storage.run(store, callback);
  }

  static getStore(): AsyncLocalStorageStore | undefined {
    return OrganizationContextService.storage.getStore();
  }
}