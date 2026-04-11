import { ContactService } from './contact.service';

describe('ContactService', () => {
  let service: ContactService;
  const contactRepository = {
    findOne: jest.fn(),
    update: jest.fn(),
  };
  const paymentRepository = {};
  const submissionRepository = {};
  const groupRepository = {};

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ContactService(
      contactRepository as any,
      paymentRepository as any,
      submissionRepository as any,
      groupRepository as any,
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
  });
});
