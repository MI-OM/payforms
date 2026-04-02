import { SubmissionService } from './services/submission.service';
import { Submission } from './entities/submission.entity';

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
  findAndCount: jest.fn(),
  findOne: jest.fn(),
});

describe('SubmissionService', () => {
  let service: SubmissionService;
  let submissionRepository: MockRepository;

  beforeEach(() => {
    submissionRepository = createMockRepository();
    service = new SubmissionService(submissionRepository as any);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('creates a submission', async () => {
    const dto = { data: { name: 'Test' }, contact_id: 'contact-1' };
    const saved = { id: 'submission-1', organization_id: 'org-1', form_id: 'form-1', ...dto } as unknown as Submission;

    submissionRepository.create.mockReturnValue({ organization_id: 'org-1', form_id: 'form-1', ...dto });
    submissionRepository.save.mockResolvedValue(saved);

    const result = await service.create('org-1', 'form-1', dto as any);

    expect(submissionRepository.create).toHaveBeenCalledWith({
      organization_id: 'org-1',
      form_id: 'form-1',
      contact_id: 'contact-1',
      data: dto.data,
    });
    expect(result).toEqual(saved);
  });

  it('finds submissions by organization', async () => {
    const data = [{ id: 'submission-1' }];
    submissionRepository.findAndCount.mockResolvedValue([data, 1]);

    const result = await service.findByOrganization('org-1', 2, 5);

    expect(submissionRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1' },
      skip: 5,
      take: 5,
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual({ data, total: 1, page: 2, limit: 5 });
  });

  it('finds a submission by id', async () => {
    const submission = { id: 'submission-1' } as Submission;
    submissionRepository.findOne.mockResolvedValue(submission);

    const result = await service.findById('org-1', 'submission-1');

    expect(submissionRepository.findOne).toHaveBeenCalledWith({ where: { id: 'submission-1', organization_id: 'org-1' } });
    expect(result).toEqual(submission);
  });

  it('finds submissions by form', async () => {
    const data = [{ id: 'submission-1' }];
    submissionRepository.findAndCount.mockResolvedValue([data, 1]);

    const result = await service.findByForm('org-1', 'form-1', 1, 10);

    expect(submissionRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', form_id: 'form-1' },
      skip: 0,
      take: 10,
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual({ data, total: 1, page: 1, limit: 10 });
  });

  it('finds submissions by contact', async () => {
    const data = [{ id: 'submission-1' }];
    submissionRepository.findAndCount.mockResolvedValue([data, 1]);

    const result = await service.findByContact('org-1', 'contact-1', 1, 10);

    expect(submissionRepository.findAndCount).toHaveBeenCalledWith({
      where: { organization_id: 'org-1', contact_id: 'contact-1' },
      skip: 0,
      take: 10,
      order: { created_at: 'DESC' },
    });
    expect(result).toEqual({ data, total: 1, page: 1, limit: 10 });
  });
});
