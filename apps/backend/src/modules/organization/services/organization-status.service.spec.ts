import { ForbiddenException } from '@nestjs/common';
import { OrganizationStatusService } from './organization-status.service';

describe('OrganizationStatusService', () => {
  let repository: { findOne: jest.Mock };
  let service: OrganizationStatusService;

  beforeEach(() => {
    repository = { findOne: jest.fn() };
    service = new OrganizationStatusService(repository as any);
  });

  describe('resolveEffectiveStatus', () => {
    it('returns active for an active organization', () => {
      expect(
        service.resolveEffectiveStatus({ status: 'active', suspended_until: null }),
      ).toBe('active');
    });

    it('returns disabled as-is', () => {
      expect(
        service.resolveEffectiveStatus({ status: 'disabled', suspended_until: null }),
      ).toBe('disabled');
    });

    it('keeps a suspension that is still in the future', () => {
      const future = new Date(Date.now() + 60_000);
      expect(
        service.resolveEffectiveStatus({ status: 'suspended', suspended_until: future }),
      ).toBe('suspended');
    });

    it('treats an expired suspension as active again', () => {
      const past = new Date(Date.now() - 60_000);
      expect(
        service.resolveEffectiveStatus({ status: 'suspended', suspended_until: past }),
      ).toBe('active');
    });

    it('treats an indefinite suspension (no expiry) as suspended', () => {
      expect(
        service.resolveEffectiveStatus({ status: 'suspended', suspended_until: null }),
      ).toBe('suspended');
    });

    it('defaults a missing status to active', () => {
      expect(
        service.resolveEffectiveStatus({ status: undefined as any, suspended_until: null }),
      ).toBe('active');
    });
  });

  describe('isBlocked', () => {
    it('is false for active', () => {
      expect(service.isBlocked({ status: 'active', suspended_until: null })).toBe(false);
    });

    it('is true for suspended', () => {
      expect(service.isBlocked({ status: 'suspended', suspended_until: null })).toBe(true);
    });

    it('is true for disabled', () => {
      expect(service.isBlocked({ status: 'disabled', suspended_until: null })).toBe(true);
    });

    it('is false once a suspension has expired', () => {
      expect(
        service.isBlocked({
          status: 'suspended',
          suspended_until: new Date(Date.now() - 1000),
        }),
      ).toBe(false);
    });
  });

  describe('isBlockedById', () => {
    it('returns false without querying for an empty id', async () => {
      await expect(service.isBlockedById('')).resolves.toBe(false);
      expect(repository.findOne).not.toHaveBeenCalled();
    });

    it('returns false when the organization does not exist', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.isBlockedById('missing')).resolves.toBe(false);
    });

    it('returns true when the organization is disabled', async () => {
      repository.findOne.mockResolvedValue({
        id: 'org-1',
        status: 'disabled',
        suspended_until: null,
      });
      await expect(service.isBlockedById('org-1')).resolves.toBe(true);
    });
  });

  describe('assertActive', () => {
    it('resolves for an active organization', async () => {
      repository.findOne.mockResolvedValue({
        id: 'org-1',
        status: 'active',
        suspended_until: null,
      });
      await expect(service.assertActive('org-1')).resolves.toBeUndefined();
    });

    it('throws ForbiddenException with the default message when blocked', async () => {
      repository.findOne.mockResolvedValue({
        id: 'org-1',
        status: 'suspended',
        suspended_until: null,
      });
      await expect(service.assertActive('org-1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('uses a caller-provided message', async () => {
      repository.findOne.mockResolvedValue({
        id: 'org-1',
        status: 'disabled',
        suspended_until: null,
      });
      await expect(
        service.assertActive('org-1', 'This form is currently unavailable'),
      ).rejects.toThrow('This form is currently unavailable');
    });
  });

  describe('getSnapshot', () => {
    it('returns null when the organization is missing', async () => {
      repository.findOne.mockResolvedValue(null);
      await expect(service.getSnapshot('missing')).resolves.toBeNull();
    });

    it('reports both stored and effective status', async () => {
      const past = new Date(Date.now() - 1000);
      repository.findOne.mockResolvedValue({
        id: 'org-1',
        status: 'suspended',
        status_reason: 'non-payment',
        status_changed_at: past,
        status_changed_by: 'platform-1',
        suspended_until: past,
      });

      const snapshot = await service.getSnapshot('org-1');

      expect(snapshot).toMatchObject({
        organization_id: 'org-1',
        stored_status: 'suspended',
        status: 'active',
        reason: 'non-payment',
        changed_by: 'platform-1',
        is_blocked: false,
      });
    });
  });
});
