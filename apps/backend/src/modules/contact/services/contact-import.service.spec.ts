import { ContactImportService } from './contact-import.service';
import { ContactImportTemplateService } from './contact-import-template.service';

describe('ContactImportService template-aware validation', () => {
  let service: ContactImportService;

  const contactImportRepository = {
    create: jest.fn((payload) => ({ id: 'import-1', ...payload })),
    save: jest.fn(async (entity) => entity),
    findOne: jest.fn(),
    find: jest.fn(),
    findAndCount: jest.fn(),
  };

  const contactRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const groupRepository = {
    find: jest.fn().mockResolvedValue([]),
  };

  const organizationRepository = {
    findOne: jest.fn(),
  };

  const contactService = {
    bulkImport: jest.fn(),
  };

  const notificationService = {
    sendPasswordResetEmail: jest.fn(),
  };

  const configService = {
    get: jest.fn(),
  };

  const contactImportTemplateService = {
    resolveTemplateForImport: jest.fn(),
    recordTemplateUsage: jest.fn().mockResolvedValue({}),
  };

  const buildTemplate = (overrides: Record<string, any> = {}) => ({
    id: 'template-1',
    organization_id: 'org-1',
    name: 'Student intake',
    description: null,
    is_default: true,
    fields_config: {
      first_name: { visible: true, required: true, label: 'First Name' },
      last_name: { visible: true, required: false, label: 'Last Name' },
      email: { visible: true, required: true, label: 'Email Address' },
      phone: { visible: true, required: false, label: 'Phone Number' },
    },
    custom_fields: [],
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    contactImportRepository.save.mockImplementation(async (entity) => entity);
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(buildTemplate());

    service = new ContactImportService(
      contactImportRepository as any,
      contactRepository as any,
      groupRepository as any,
      organizationRepository as any,
      contactService as any,
      notificationService as any,
      configService as any,
      contactImportTemplateService as any,
    );
  });

  const validate = (contacts: Array<Record<string, any>>, templateId: string | null = 'template-1') =>
    service.validateImport('org-1', contacts, 'user-1', templateId);

  it('records the template against the import job', async () => {
    await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(contactImportTemplateService.recordTemplateUsage).toHaveBeenCalledWith(
      'org-1',
      'import-1',
      'template-1',
      expect.objectContaining({ id: 'template-1' }),
    );
  });

  it('stores the template id on the import job', async () => {
    await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(contactImportRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: 'template-1' }),
    );
  });

  it('treats the built-in system default as having no template id', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({ id: 'system-default-org-1' }),
    );

    await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(contactImportRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({ template_id: null }),
    );
    // The snapshot is still recorded, so the audit trail says what was expected.
    expect(contactImportTemplateService.recordTemplateUsage).toHaveBeenCalledWith(
      'org-1',
      'import-1',
      null,
      expect.objectContaining({ id: 'system-default-org-1' }),
    );
  });

  it('fails a row that is missing a template-required field', async () => {
    const result = await validate([{ email: 'jane@example.com' }]);

    expect(result.failure_count).toBe(1);
    expect(result.errors[0].errors).toContain('First Name is required');
  });

  it('accepts a row that satisfies the template', async () => {
    const result = await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(result.failure_count).toBe(0);
    expect(result.status).toBe('VALIDATED');
  });

  it('does not require fields the template marks optional', async () => {
    const result = await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(result.errors).toHaveLength(0);
  });

  it('fails a row that is missing a required custom field', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({
        custom_fields: [
          { id: 'cf-1', name: 'academic_year', label: 'Academic Year', type: 'text', required: true },
        ],
      }),
    );

    const result = await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(result.failure_count).toBe(1);
    expect(result.errors[0].errors).toContain('Academic Year is required');
  });

  it('accepts a row that supplies a required custom field', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({
        custom_fields: [
          { id: 'cf-1', name: 'academic_year', label: 'Academic Year', type: 'text', required: true },
        ],
      }),
    );

    const result = await validate([
      { first_name: 'Jane', email: 'jane@example.com', custom_fields: { 'cf-1': '2026/2027' } },
    ]);

    expect(result.failure_count).toBe(0);
  });

  it('validates a custom field value against its type', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({
        custom_fields: [
          { id: 'cf-1', name: 'email_alt', label: 'Alt Email', type: 'email', required: false },
        ],
      }),
    );

    const result = await validate([
      { first_name: 'Jane', email: 'jane@example.com', custom_fields: { 'cf-1': 'not-an-email' } },
    ]);

    expect(result.failure_count).toBe(1);
    expect(result.errors[0].errors).toContain('Alt Email must be a valid email address');
  });

  it('rejects a select value that is not one of the options', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({
        custom_fields: [
          {
            id: 'cf-1',
            name: 'house',
            label: 'House',
            type: 'select',
            required: false,
            options: ['Red', 'Blue'],
          },
        ],
      }),
    );

    const result = await validate([
      { first_name: 'Jane', email: 'jane@example.com', custom_fields: { 'cf-1': 'Green' } },
    ]);

    expect(result.errors[0].errors).toContain('House must be one of: Red, Blue');
  });

  it('rejects a non-numeric value for a number custom field', async () => {
    contactImportTemplateService.resolveTemplateForImport.mockResolvedValue(
      buildTemplate({
        custom_fields: [
          { id: 'cf-1', name: 'score', label: 'Score', type: 'number', required: false },
        ],
      }),
    );

    const result = await validate([
      { first_name: 'Jane', email: 'jane@example.com', custom_fields: { 'cf-1': 'high' } },
    ]);

    expect(result.errors[0].errors).toContain('Score must be a number');
  });

  it('still applies the hard name and email rules regardless of the template', async () => {
    const result = await validate([{ phone: '+2348012345678' }]);

    const messages = result.errors[0].errors.join(' ');
    expect(messages).toMatch(/Name is required/);
    expect(messages).toMatch(/Email is required/);
  });

  it('reports the template used in the response', async () => {
    const result = await validate([{ first_name: 'Jane', email: 'jane@example.com' }]);

    expect(result.template).toEqual({
      id: 'template-1',
      name: 'Student intake',
      is_default: true,
    });
  });
});
