import { ContactController } from './contact.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const jest: any;

type MockContactService = ReturnType<typeof mockContactService>;

type MockImportService = ReturnType<typeof mockContactImportService>;

const mockContactService = () => ({
  create: jest.fn(),
  findByOrganization: jest.fn(),
  exportContacts: jest.fn(),
  findById: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  bulkImport: jest.fn(),
  getTransactionHistory: jest.fn(),
  exportTransactionHistory: jest.fn(),
  assignToGroups: jest.fn(),
  parseCsvImport: jest.fn(),
});

const mockContactImportService = () => ({
  validateImport: jest.fn(),
  commitImport: jest.fn(),
  listImports: jest.fn(),
  getImport: jest.fn(),
  sendPasswordSetupEmails: jest.fn(),
});

describe('ContactController', () => {
  let contactController: ContactController;
  let contactService: MockContactService;
  let contactImportService: MockImportService;

  beforeEach(() => {
    contactService = mockContactService();
    contactImportService = mockContactImportService();
    contactController = new ContactController(contactService as any, contactImportService as any);
  });

  it('creates a contact', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { name: 'Jane Doe', email: 'jane@example.com' };
    contactService.create.mockResolvedValue({ id: 'contact-1' });
    contactImportService.sendPasswordSetupEmails.mockResolvedValue(undefined);

    const result = await contactController.createContact(req as any, dto as any);

    expect(contactService.create).toHaveBeenCalledWith('org-1', dto);
    expect(contactImportService.sendPasswordSetupEmails).toHaveBeenCalledWith('org-1', [{ id: 'contact-1' }]);
    expect(result).toEqual({ id: 'contact-1' });
  });

  it('lists contacts', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const query = { page: 1, limit: 20 };
    contactService.findByOrganization.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await contactController.listContacts(req as any, query as any);

    expect(contactService.findByOrganization).toHaveBeenCalledWith('org-1', 1, 20, undefined);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('exports contacts and sets CSV headers', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    contactService.exportContacts.mockResolvedValue('csv-data');

    const result = await contactController.exportContacts(req as any, res as any, { group_id: 'group-1' } as any);

    expect(contactService.exportContacts).toHaveBeenCalledWith('org-1', 'group-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="contacts.csv"');
    expect(result).toEqual('csv-data');
  });

  it('gets a contact by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactService.findById.mockResolvedValue({ id: 'contact-1' });

    const result = await contactController.getContact(req as any, 'contact-1');

    expect(contactService.findById).toHaveBeenCalledWith('org-1', 'contact-1');
    expect(result).toEqual({ id: 'contact-1' });
  });

  it('updates a contact', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { name: 'Updated' };
    contactService.update.mockResolvedValue({ id: 'contact-1', name: 'Updated' });

    const result = await contactController.updateContact(req as any, 'contact-1', dto as any);

    expect(contactService.update).toHaveBeenCalledWith('org-1', 'contact-1', dto);
    expect(result).toEqual({ id: 'contact-1', name: 'Updated' });
  });

  it('deletes a contact', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactService.delete.mockResolvedValue({ affected: 1 });

    const result = await contactController.deleteContact(req as any, 'contact-1');

    expect(contactService.delete).toHaveBeenCalledWith('org-1', 'contact-1');
    expect(result).toEqual({ affected: 1 });
  });

  it('bulk imports contacts', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { contacts: [{ name: 'A', email: 'a@example.com' }] };
    contactService.bulkImport.mockResolvedValue([{ id: 'contact-1' }]);
    contactImportService.sendPasswordSetupEmails.mockResolvedValue(undefined);

    const result = await contactController.bulkImport(req as any, dto as any);

    expect(contactService.bulkImport).toHaveBeenCalledWith('org-1', dto.contacts);
    expect(contactImportService.sendPasswordSetupEmails).toHaveBeenCalledWith('org-1', [{ id: 'contact-1' }]);
    expect(result).toEqual([{ id: 'contact-1' }]);
  });

  it('validates import payload', async () => {
    const req = { user: { organization_id: 'org-1', id: 'user-1' } };
    const dto = { contacts: [{ name: 'A', email: 'a@example.com' }] };
    contactImportService.validateImport.mockResolvedValue({ import_id: 'import-1' });

    const result = await contactController.validateImport(req as any, dto as any);

    expect(contactImportService.validateImport).toHaveBeenCalledWith('org-1', dto.contacts, 'user-1');
    expect(result).toEqual({ import_id: 'import-1' });
  });

  it('validates CSV import payload', async () => {
    const req = { user: { organization_id: 'org-1', id: 'user-1' } };
    const dto = { csv: 'name,email,phone,external_id\nJane Doe,jane@example.com,+2348012345678,student-123' };
    const parsed = [{ name: 'Jane Doe', email: 'jane@example.com', phone: '+2348012345678', external_id: 'student-123' }];
    contactService.parseCsvImport = jest.fn().mockReturnValue(parsed);
    contactImportService.validateImport.mockResolvedValue({ import_id: 'import-1' });

    const result = await contactController.validateCsvImport(req as any, dto as any);

    expect(contactService.parseCsvImport).toHaveBeenCalledWith(dto.csv);
    expect(contactImportService.validateImport).toHaveBeenCalledWith('org-1', parsed, 'user-1');
    expect(result).toEqual({ import_id: 'import-1' });
  });

  it('commits a validated CSV import', async () => {
    const req = { user: { organization_id: 'org-1', id: 'user-1' } };
    const dto = { csv: 'name,email\nJane Doe,jane@example.com' };
    const parsed = [{ name: 'Jane Doe', email: 'jane@example.com' }];
    contactService.parseCsvImport = jest.fn().mockReturnValue(parsed);
    contactImportService.validateImport.mockResolvedValue({ import_id: 'import-1', status: 'VALIDATED' });
    contactImportService.commitImport.mockResolvedValue({ import_id: 'import-1', status: 'COMPLETED' });

    const result = await contactController.commitCsvImport(req as any, dto as any);

    expect(contactService.parseCsvImport).toHaveBeenCalledWith(dto.csv);
    expect(contactImportService.validateImport).toHaveBeenCalledWith('org-1', parsed, 'user-1');
    expect(contactImportService.commitImport).toHaveBeenCalledWith('org-1', 'import-1');
    expect(result).toEqual({ import_id: 'import-1', status: 'COMPLETED' });
  });

  it('commits an import', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactImportService.commitImport.mockResolvedValue({ import_id: 'import-1' });

    const result = await contactController.commitImport(req as any, 'import-1');

    expect(contactImportService.commitImport).toHaveBeenCalledWith('org-1', 'import-1');
    expect(result).toEqual({ import_id: 'import-1' });
  });

  it('lists imports', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactImportService.listImports.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await contactController.listImports(req as any, 1, 20);

    expect(contactImportService.listImports).toHaveBeenCalledWith('org-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('gets an import by id', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactImportService.getImport.mockResolvedValue({ id: 'import-1' });

    const result = await contactController.getImport(req as any, 'import-1');

    expect(contactImportService.getImport).toHaveBeenCalledWith('org-1', 'import-1');
    expect(result).toEqual({ id: 'import-1' });
  });

  it('gets transaction history JSON', async () => {
    const req = { user: { organization_id: 'org-1' } };
    contactService.getTransactionHistory.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

    const result = await contactController.getTransactionHistory(req as any, 'contact-1', { page: 1, limit: 20 } as any);

    expect(contactService.getTransactionHistory).toHaveBeenCalledWith('org-1', 'contact-1', 1, 20);
    expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
  });

  it('exports transaction history CSV', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const res = { setHeader: jest.fn() };
    contactService.exportTransactionHistory.mockResolvedValue('csv-data');

    const result = await contactController.getTransactionHistory(req as any, 'contact-1', { format: 'csv' } as any, res as any);

    expect(contactService.exportTransactionHistory).toHaveBeenCalledWith('org-1', 'contact-1');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="contact_contact-1_transactions.csv"');
    expect(result).toEqual('csv-data');
  });

  it('assigns a contact to groups', async () => {
    const req = { user: { organization_id: 'org-1' } };
    const dto = { group_ids: ['group-1'] };
    contactService.assignToGroups.mockResolvedValue({ id: 'contact-1' });

    const result = await contactController.assignToGroups(req as any, 'contact-1', dto as any);

    expect(contactService.assignToGroups).toHaveBeenCalledWith('org-1', 'contact-1', dto.group_ids);
    expect(result).toEqual({ id: 'contact-1' });
  });
});
