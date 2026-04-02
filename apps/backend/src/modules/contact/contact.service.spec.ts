import { NotFoundException } from '@nestjs/common';
import { ContactService } from './services/contact.service';
import { Contact } from './entities/contact.entity';
import { Payment } from '../payment/entities/payment.entity';
import { Submission } from '../submission/entities/submission.entity';
import { Group } from '../group/entities/group.entity';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

type MockRepository = Record<string, any>;

const createMockRepository = (): MockRepository => ({
  create: jest.fn(),
  save: jest.fn(),
  findOne: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  find: jest.fn(),
  createQueryBuilder: jest.fn(),
});

describe('ContactService', () => {
  let contactService: ContactService;
  let contactRepository: MockRepository;
  let paymentRepository: MockRepository;
  let submissionRepository: MockRepository;
  let groupRepository: MockRepository;
  let queryBuilder: any;

  beforeEach(() => {
    contactRepository = createMockRepository();
    paymentRepository = createMockRepository();
    submissionRepository = createMockRepository();
    groupRepository = createMockRepository();

    queryBuilder = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      distinct: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn(),
      getMany: jest.fn(),
      getCount: jest.fn(),
    };

    contactRepository.createQueryBuilder.mockReturnValue(queryBuilder);
    paymentRepository.createQueryBuilder.mockReturnValue(queryBuilder);

    contactService = new ContactService(
      contactRepository as any,
      paymentRepository as any,
      submissionRepository as any,
      groupRepository as any,
    );
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a contact', async () => {
    const dto = { first_name: 'Jane', last_name: 'Doe', email: 'jane@example.com' };
    const savedContact = { id: 'contact-1', organization_id: 'org-1', ...dto, is_active: true } as unknown as Contact;

    contactRepository.create.mockReturnValue({ organization_id: 'org-1', ...dto, is_active: true });
    contactRepository.save.mockResolvedValue(savedContact);

    const result = await contactService.create('org-1', dto as any);

    expect(contactRepository.create).toHaveBeenCalledWith({
      organization_id: 'org-1',
      ...dto,
      email: 'jane@example.com',
      is_active: true,
    });
    expect(result).toEqual(savedContact);
  });

  it('lists contacts with pagination', async () => {
    const contacts = [{ id: 'contact-1' }];
    queryBuilder.getManyAndCount.mockResolvedValue([contacts, 1]);

    const result = await contactService.findByOrganization('org-1', 2, 10, 'group-1');

    expect(queryBuilder.andWhere).toHaveBeenCalledWith('group.id = :groupId', { groupId: 'group-1' });
    expect(queryBuilder.skip).toHaveBeenCalledWith(10);
    expect(queryBuilder.take).toHaveBeenCalledWith(10);
    expect(result).toEqual({ data: contacts, total: 1, page: 2, limit: 10 });
  });

  it('exports contacts as CSV', async () => {
    const contacts = [
      {
        id: 'contact-1',
        first_name: 'Jane',
        middle_name: '',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '+123456',
        gender: 'F',
        student_id: 'STU-123',
        external_id: 'ext-1',
        guardian_name: '',
        guardian_email: '',
        guardian_phone: '',
        is_active: true,
        password_hash: null,
        must_reset_password: false,
        groups: [{ id: 'group-a', name: 'Group A' }],
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as any;

    queryBuilder.getMany.mockResolvedValue(contacts);
    groupRepository.find.mockResolvedValue([{ id: 'group-a', name: 'Group A', parent_group_id: null } as Group]);

    const csv = await contactService.exportContacts('org-1', 'group-1');

    expect(csv).toContain('id,first_name,middle_name,last_name,email,phone,gender,student_id,external_id,guardian_name,guardian_email,guardian_phone,status,is_active,require_login,must_reset_password,groups,group_paths,created_at');
    expect(csv).toContain('contact-1');
    expect(csv).toContain('Group A');
  });

  it('escapes formula-like CSV values in contact export', async () => {
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'contact-1',
        first_name: '@finance',
        middle_name: '',
        last_name: '',
        email: 'jane@example.com',
        phone: null,
        gender: '',
        student_id: '',
        external_id: null,
        guardian_name: '',
        guardian_email: '',
        guardian_phone: '',
        is_active: true,
        password_hash: null,
        must_reset_password: false,
        groups: [],
        created_at: new Date('2026-01-01T00:00:00.000Z'),
      },
    ] as any);
    groupRepository.find.mockResolvedValue([]);

    const csv = await contactService.exportContacts('org-1');

    expect(csv).toContain(`"'@finance"`);
  });

  it('finds a contact by id', async () => {
    const contact = { id: 'contact-1' } as Contact;
    contactRepository.findOne.mockResolvedValue(contact);

    const result = await contactService.findById('org-1', 'contact-1');

    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'contact-1', organization_id: 'org-1' },
      relations: ['groups'],
    });
    expect(result).toEqual(contact);
  });

  it('updates a contact and returns the updated record', async () => {
    const updated = { id: 'contact-1', first_name: 'Jane', last_name: 'Updated' } as unknown as Contact;
    contactRepository.update.mockResolvedValue(undefined);
    contactRepository.findOne.mockResolvedValue(updated);

    const result = await contactService.update('org-1', 'contact-1', { first_name: 'Jane', last_name: 'Updated' });

    expect(contactRepository.update).toHaveBeenCalledWith(
      { id: 'contact-1', organization_id: 'org-1' },
      { first_name: 'Jane', last_name: 'Updated' },
    );
    expect(result).toEqual(updated);
  });

  it('deletes a contact', async () => {
    contactRepository.delete.mockResolvedValue({ affected: 1 });

    const result = await contactService.delete('org-1', 'contact-1');

    expect(contactRepository.delete).toHaveBeenCalledWith({ id: 'contact-1', organization_id: 'org-1' });
    expect(result).toEqual({ affected: 1 });
  });

  it('finds a contact by email', async () => {
    const contact = { id: 'contact-1', email: 'jane@example.com' } as Contact;
    contactRepository.findOne.mockResolvedValue(contact);

    const result = await contactService.findByEmail('org-1', 'jane@example.com');

    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', email: 'jane@example.com' },
    });
    expect(result).toEqual(contact);
  });

  it('returns transaction history with paging', async () => {
    contactRepository.findOne.mockResolvedValue({ id: 'contact-1' } as Contact);
    queryBuilder.getManyAndCount.mockResolvedValue([[{ id: 'payment-1' }], 1]);

    const result = await contactService.getTransactionHistory('org-1', 'contact-1', 1, 10);

    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'contact-1', organization_id: 'org-1' },
      relations: ['groups'],
    });
    expect(result).toEqual({ data: [{ id: 'payment-1' }], total: 1, page: 1, limit: 10 });
  });

  it('exports transaction history as CSV', async () => {
    contactRepository.findOne.mockResolvedValue({ id: 'contact-1', email: 'jane@example.com' } as Contact);
    queryBuilder.getMany.mockResolvedValue([
      {
        id: 'payment-1',
        reference: 'ref-1',
        amount: 500,
        status: 'PAID',
        paid_at: new Date('2026-01-02T00:00:00.000Z'),
        created_at: new Date('2026-01-01T00:00:00.000Z'),
        submission: { id: 'submission-1', form_id: 'form-1' },
      },
    ]);

    const csv = await contactService.exportTransactionHistory('org-1', 'contact-1');

    expect(csv).toContain('id,reference,amount,status,paid_at,created_at,submission_id,form_id,contact_id,contact_email');
    expect(csv).toContain('ref-1');
    expect(csv).toContain('submission-1');
    expect(csv).toContain('jane@example.com');
  });

  it('creates a public contact', async () => {
    const savedContact = { id: 'contact-1', first_name: 'Public', last_name: 'User', email: 'public@example.com' } as unknown as Contact;
    contactRepository.create.mockReturnValue({ organization_id: 'org-1', first_name: 'Public', last_name: 'User', email: 'public@example.com', is_active: true, must_reset_password: false });
    contactRepository.save.mockResolvedValue(savedContact);

    const result = await contactService.createFromPublic('org-1', 'Public', 'User', 'public@example.com');

    expect(contactRepository.create).toHaveBeenCalledWith({
      organization_id: 'org-1',
      first_name: 'Public',
      last_name: 'User',
      email: 'public@example.com',
      is_active: true,
      must_reset_password: false,
    });
    expect(result).toEqual(savedContact);
  });

  it('bulk imports contacts', async () => {
    const contacts = [{ name: 'A', email: 'a@example.com' }, { name: 'B', email: 'b@example.com' }];
    contactRepository.create.mockImplementation(contact => contact);
    contactRepository.find.mockResolvedValue([]);
    groupRepository.find.mockResolvedValue([]);
    contactRepository.save.mockImplementation((items: any[]) =>
      items.map(item => ({ ...item, id: 'contact' } as Contact)),
    );

    const result = await contactService.bulkImport('org-1', contacts as any[]);

    expect(contactRepository.create).toHaveBeenCalledTimes(2);
    expect(result).toEqual([
      {
        first_name: 'A',
        organization_id: 'org-1',
        email: 'a@example.com',
        phone: undefined,
        external_id: undefined,
        gender: undefined,
        student_id: undefined,
        guardian_name: undefined,
        guardian_email: undefined,
        guardian_phone: undefined,
        is_active: true,
        must_reset_password: false,
        password_reset_token: null,
        password_reset_expires_at: null,
        groups: [],
        id: 'contact',
      },
      {
        first_name: 'B',
        organization_id: 'org-1',
        email: 'b@example.com',
        phone: undefined,
        external_id: undefined,
        gender: undefined,
        student_id: undefined,
        guardian_name: undefined,
        guardian_email: undefined,
        guardian_phone: undefined,
        is_active: true,
        must_reset_password: false,
        password_reset_token: null,
        password_reset_expires_at: null,
        groups: [],
        id: 'contact',
      },
    ]);
  });

  it('parses CSV import rows into contact payloads', () => {
    const csv = 'first_name,last_name,email,phone,external_id,groups,group_paths,require_login,is_active,must_reset_password\n' +
      'Jane,Doe,jane@example.com,+2348012345678,student-123,"Returning Students; Priority","Faculty > Engineering",true,true,false\n' +
      'John,Smith,john@example.com,,student-456,,"Science > 200 Level",1,0,yes';

    const parsed = contactService.parseCsvImport(csv);

    expect(parsed).toEqual([
      {
        first_name: 'Jane',
        last_name: 'Doe',
        email: 'jane@example.com',
        phone: '+2348012345678',
        external_id: 'student-123',
        groups: ['Returning Students', 'Priority'],
        group_paths: ['Faculty > Engineering'],
        require_login: true,
        is_active: true,
        must_reset_password: false,
      },
      {
        first_name: 'John',
        last_name: 'Smith',
        email: 'john@example.com',
        phone: undefined,
        external_id: 'student-456',
        groups: undefined,
        group_paths: ['Science > 200 Level'],
        require_login: true,
        is_active: false,
        must_reset_password: true,
      },
    ]);
  });

  it('assigns a contact to groups', async () => {
    const contact = { id: 'contact-1', organization_id: 'org-1', groups: [] } as unknown as Contact;
    const groups = [{ id: 'group-1', organization_id: 'org-1', name: 'Group 1' }] as any[];
    const savedContact = { ...contact, groups } as unknown as Contact;
    contactRepository.findOne.mockResolvedValue(contact);
    groupRepository.find.mockResolvedValue(groups);
    contactRepository.save.mockResolvedValue(savedContact);

    const result = await contactService.assignToGroups('org-1', 'contact-1', ['group-1']);

    expect(contactRepository.findOne).toHaveBeenCalledWith({
      where: { id: 'contact-1', organization_id: 'org-1' },
      relations: ['groups'],
    });
    expect(contactRepository.save).toHaveBeenCalledWith({
      ...contact,
      groups,
    });
    expect(result).toEqual(savedContact);
  });

  it('throws NotFoundException when assigning missing groups', async () => {
    const contact = { id: 'contact-1', organization_id: 'org-1', groups: [] } as unknown as Contact;
    contactRepository.findOne.mockResolvedValue(contact);
    groupRepository.find.mockResolvedValue([]);

    await expect(contactService.assignToGroups('org-1', 'contact-1', ['group-1'])).rejects.toThrow(NotFoundException);
  });

  it('throws NotFoundException when assigning groups to missing contact', async () => {
    contactRepository.findOne.mockResolvedValue(null);

    await expect(contactService.assignToGroups('org-1', 'contact-1', ['group-1'])).rejects.toThrow(NotFoundException);
  });
});
