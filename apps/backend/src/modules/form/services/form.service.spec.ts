import { NotFoundException } from '@nestjs/common';
import { FormService } from './form.service';

describe('FormService', () => {
  let service: FormService;
  const formRepository = {
    find: jest.fn(),
  };
  const fieldRepository = {};
  const targetRepository = {};
  const groupRepository = {
    findOne: jest.fn(),
    find: jest.fn(),
  };
  const contactRepository = {
    findOne: jest.fn(),
  };
  const cacheService = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new FormService(
      formRepository as any,
      fieldRepository as any,
      targetRepository as any,
      groupRepository as any,
      contactRepository as any,
      cacheService as any,
    );
  });

  describe('findAccessibleByContact', () => {
    it('returns only forms accessible to the contact and preserves pagination', async () => {
      contactRepository.findOne.mockResolvedValue({
        id: 'contact-1',
        organization_id: 'org-1',
        groups: [{ id: 'group-child' }],
      });

      formRepository.find.mockResolvedValue([
        {
          id: 'form-open',
          title: 'Open Form',
          slug: 'open-form',
          payment_type: 'FIXED',
          allow_partial: false,
          amount: 1000,
          access_mode: 'OPEN',
          identity_validation_mode: 'NONE',
          targets: [],
          created_at: new Date('2026-01-01T00:00:00.000Z'),
        },
        {
          id: 'form-login',
          title: 'Login Form',
          slug: 'login-form',
          payment_type: 'FIXED',
          allow_partial: false,
          amount: 2000,
          access_mode: 'LOGIN_REQUIRED',
          identity_validation_mode: 'NONE',
          targets: [],
          created_at: new Date('2026-01-02T00:00:00.000Z'),
        },
        {
          id: 'form-direct',
          title: 'Direct Target Form',
          slug: 'direct-form',
          payment_type: 'FIXED',
          allow_partial: false,
          amount: 3000,
          access_mode: 'TARGETED_ONLY',
          identity_validation_mode: 'NONE',
          targets: [{ target_type: 'contact', target_id: 'contact-1' }],
          created_at: new Date('2026-01-03T00:00:00.000Z'),
        },
        {
          id: 'form-group',
          title: 'Group Target Form',
          slug: 'group-form',
          payment_type: 'FIXED',
          allow_partial: false,
          amount: 4000,
          access_mode: 'TARGETED_ONLY',
          identity_validation_mode: 'NONE',
          targets: [{ target_type: 'group', target_id: 'group-parent' }],
          created_at: new Date('2026-01-04T00:00:00.000Z'),
        },
        {
          id: 'form-denied',
          title: 'Denied Form',
          slug: 'denied-form',
          payment_type: 'FIXED',
          allow_partial: false,
          amount: 5000,
          access_mode: 'TARGETED_ONLY',
          identity_validation_mode: 'NONE',
          targets: [{ target_type: 'group', target_id: 'group-other' }],
          created_at: new Date('2026-01-05T00:00:00.000Z'),
        },
      ]);

      groupRepository.findOne.mockImplementation(({ where }: any) => {
        const groupId = where.id;
        if (groupId === 'group-parent' || groupId === 'group-child' || groupId === 'group-other') {
          return Promise.resolve({ id: groupId, organization_id: 'org-1' });
        }
        return Promise.resolve(null);
      });

      groupRepository.find.mockImplementation(({ where }: any) => {
        if (where.parent_group_id === 'group-parent') {
          return Promise.resolve([{ id: 'group-child', organization_id: 'org-1' }]);
        }
        return Promise.resolve([]);
      });

      const pageOne = await service.findAccessibleByContact('org-1', 'contact-1', 1, 2);
      expect(pageOne.total).toBe(4);
      expect(pageOne.data.map(form => form.id)).toEqual(['form-open', 'form-login']);
      expect(pageOne.data.every(form => form.is_targeted === false)).toBe(true);

      const pageTwo = await service.findAccessibleByContact('org-1', 'contact-1', 2, 2);
      expect(pageTwo.total).toBe(4);
      expect(pageTwo.data.map(form => form.id)).toEqual(['form-direct', 'form-group']);
      expect(pageTwo.data.every(form => form.is_targeted === true)).toBe(true);
    });

    it('throws when contact does not exist', async () => {
      contactRepository.findOne.mockResolvedValue(null);

      await expect(
        service.findAccessibleByContact('org-1', 'missing-contact', 1, 20),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
