import { NotFoundException } from '@nestjs/common';
import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  const contactRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
    createQueryBuilder: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const paymentRepository = {};
  const submissionRepository = {};
  const groupRepository = {
    find: jest.fn(),
  };
  const billingService = {
    assertWithinHardLimit: jest.fn().mockResolvedValue(undefined),
    recordUsage: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactService(
      contactRepository as any,
      paymentRepository as any,
      submissionRepository as any,
      groupRepository as any,
      billingService as any,
    );
  });

  describe('update', () => {
    it('invalidates active tokens when deactivating a contact', async () => {
      const updatedContact = {
        id: 'contact-1',
        organization_id: 'org-1',
        is_active: false,
      };

      contactRepository.findOne
        .mockResolvedValueOnce({ id: 'contact-1', is_active: true })
        .mockResolvedValueOnce(updatedContact);

      await service.update('org-1', 'contact-1', { is_active: false });

      expect(contactRepository.update).toHaveBeenCalledTimes(1);
      const [, payload] = contactRepository.update.mock.calls[0];
      expect(payload.is_active).toBe(false);
      expect(payload.token_invalidated_at).toBeInstanceOf(Date);
    });

    it('does not touch token_invalidated_at when is_active is unchanged', async () => {
      const updatedContact = {
        id: 'contact-1',
        organization_id: 'org-1',
        is_active: true,
      };

      contactRepository.findOne
        .mockResolvedValueOnce({ id: 'contact-1', is_active: true })
        .mockResolvedValueOnce(updatedContact);

      await service.update('org-1', 'contact-1', { first_name: 'Ada' });

      const [, payload] = contactRepository.update.mock.calls[0];
      expect(payload.first_name).toBe('Ada');
      expect(payload.token_invalidated_at).toBeUndefined();
    });

    it('returns null when contact is missing', async () => {
      contactRepository.findOne.mockResolvedValueOnce(null);

      const result = await service.update('org-1', 'missing-contact', { is_active: false });

      expect(result).toBeNull();
      expect(contactRepository.update).not.toHaveBeenCalled();
    });

    it('issues a password setup token when must_reset_password is true', async () => {
      const updatedContact = {
        id: 'contact-1',
        organization_id: 'org-1',
        is_active: true,
      };

      contactRepository.findOne
        .mockResolvedValueOnce({ id: 'contact-1', is_active: true })
        .mockResolvedValueOnce(updatedContact);

      const result = await service.update('org-1', 'contact-1', { must_reset_password: true });

      const [, payload] = contactRepository.update.mock.calls[0];
      expect(payload.must_reset_password).toBe(true);
      expect(payload.password_reset_token).toBeDefined();
      expect(payload.password_reset_expires_at).toBeInstanceOf(Date);
      expect(result).toMatchObject({ password_setup_token: expect.any(String) });
    });

    it('clears password setup flag without issuing a token when must_reset_password is false', async () => {
      const updatedContact = {
        id: 'contact-1',
        organization_id: 'org-1',
        is_active: true,
      };

      contactRepository.findOne
        .mockResolvedValueOnce({ id: 'contact-1', is_active: true })
        .mockResolvedValueOnce(updatedContact);

      const result = await service.update('org-1', 'contact-1', { must_reset_password: false });

      const [, payload] = contactRepository.update.mock.calls[0];
      expect(payload.must_reset_password).toBe(false);
      expect(payload.password_reset_token).toBeUndefined();
      expect(result).toMatchObject({ password_setup_token: null });
    });
  });

  describe('create', () => {
    it('assigns the contact to the provided groups on creation', async () => {
      const groupOne = { id: 'group-1', name: 'Returning Students' };
      const groupTwo = { id: 'group-2', name: 'Priority' };
      groupRepository.find = jest.fn().mockResolvedValue([groupOne, groupTwo]);

      let createdPayload: any;
      contactRepository.create = jest.fn(payload => ({ ...payload }));
      contactRepository.save = jest.fn(contact => {
        createdPayload = contact;
        return Promise.resolve({ id: 'contact-new', ...contact });
      });

      const result = await service.create('org-1', {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        group_ids: ['group-1', 'group-2'],
      });

      expect(groupRepository.find).toHaveBeenCalledWith({
        where: { organization_id: 'org-1', id: expect.anything() },
      });
      expect(createdPayload.groups).toEqual([groupOne, groupTwo]);
      expect(result.password_setup_token).toBeDefined();
    });

    it('throws NotFoundException when a provided group does not exist', async () => {
      groupRepository.find = jest.fn().mockResolvedValue([{ id: 'group-1', name: 'Returning Students' }]);
      contactRepository.create = jest.fn(payload => ({ ...payload }));
      contactRepository.save = jest.fn();

      await expect(
        service.create('org-1', {
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@example.com',
          group_ids: ['group-1', 'missing-group'],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrganization', () => {
    it('applies active and has_balance filters to the query', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contactRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrganization('org-1', 1, 20, undefined, {
        status: 'active',
        balance: 'has_balance',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('contact.is_active = true');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('EXISTS ('),
      );
    });

    it('applies inactive and no_balance filters to the query', async () => {
      const qb: any = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        distinct: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      };
      contactRepository.createQueryBuilder.mockReturnValue(qb);

      await service.findByOrganization('org-1', 1, 20, undefined, {
        status: 'inactive',
        balance: 'no_balance',
      });

      expect(qb.andWhere).toHaveBeenCalledWith('contact.is_active = false');
      expect(qb.andWhere).toHaveBeenCalledWith(
        expect.stringContaining('NOT EXISTS ('),
      );
    });
  });
});
