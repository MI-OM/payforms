import { ReportController } from './report.controller';

declare const describe: any;
declare const it: any;
declare const expect: any;
declare const beforeEach: any;
declare const afterEach: any;
declare const jest: any;

describe('ReportController', () => {
  let controller: ReportController;
  let reportService: any;

  beforeEach(() => {
    reportService = {
      getSummary: jest.fn().mockResolvedValue({ forms: 1 }),
      getAnalytics: jest.fn().mockResolvedValue({ submissions_by_day: [] }),
      getFormPerformance: jest.fn().mockResolvedValue({ data: [] }),
      exportReport: jest.fn().mockResolvedValue('exported'),
    };

    controller = new ReportController(reportService);
  });

  it('calls getSummary with organization and query params', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;
    const result = await controller.getSummary(req, '2026-01-01', '2026-01-31');

    expect(reportService.getSummary).toHaveBeenCalledWith('org-1', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ forms: 1 });
  });

  it('calls getAnalytics with organization and query params', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;
    const result = await controller.getAnalytics(req, '2026-01-01', '2026-01-31');

    expect(reportService.getAnalytics).toHaveBeenCalledWith('org-1', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ submissions_by_day: [] });
  });

  it('calls getFormPerformance with organization and query params', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;
    const result = await controller.getFormPerformance(req, '2026-01-01', '2026-01-31');

    expect(reportService.getFormPerformance).toHaveBeenCalledWith('org-1', '2026-01-01', '2026-01-31');
    expect(result).toEqual({ data: [] });
  });

  it('exports csv report and sets response headers', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;
    const res = { setHeader: jest.fn() } as any;
    const result = await controller.exportReport(req, res, 'summary', 'csv', '2026-01-01', '2026-01-31');

    expect(reportService.exportReport).toHaveBeenCalledWith('org-1', 'summary', 'csv', '2026-01-01', '2026-01-31');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="report-summary.csv"');
    expect(result).toBe('exported');
  });

  it('exports pdf report and sets response headers', async () => {
    const req = { user: { organization_id: 'org-1' } } as any;
    const res = { setHeader: jest.fn() } as any;
    reportService.exportReport.mockResolvedValue(Buffer.from('pdf')); 

    const result = await controller.exportReport(req, res, 'analytics', 'pdf', '2026-01-01', '2026-01-31');

    expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(res.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="report-analytics.pdf"');
    expect(result).toEqual(Buffer.from('pdf'));
  });
});
