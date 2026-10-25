import { apiClient } from './api';

export type ContactImportStatus = 'PENDING' | 'VALIDATED' | 'FAILED' | 'COMPLETED';

export interface ImportRowError {
  row_index: number;
  row: Record<string, any> | null;
  errors: string[];
}

export interface ImportValidationResult {
  import_id: string;
  status: ContactImportStatus;
  total_count: number;
  success_count: number;
  failure_count: number;
  errors: ImportRowError[];
  template?: {
    id: string | null;
    name: string;
    is_default: boolean;
  };
}

export interface ImportCommitResult {
  import_id: string;
  status: ContactImportStatus;
  created_count: number;
}

export interface ContactImportJob {
  id: string;
  organization_id: string;
  created_by?: string;
  template_id: string | null;
  status: ContactImportStatus;
  total_count: number;
  success_count: number;
  failure_count: number;
  completed_at: string | null;
  created_at: string;
}

class ContactImportService {
  /**
   * Validate a CSV payload against an import template.
   *
   * Validation never writes contacts — it produces an import job and a list
   * of row errors, so the operator can fix the file and try again.
   */
  async validateCsv(csv: string, templateId?: string | null): Promise<ImportValidationResult> {
    return apiClient.post('/contacts/imports/csv/validate', {
      csv,
      template_id: templateId || undefined,
    });
  }

  /**
   * Commit a validated import, creating the contacts.
   */
  async commit(importId: string): Promise<ImportCommitResult> {
    return apiClient.post(`/contacts/imports/${importId}/commit`);
  }

  /**
   * Recent import jobs for the organization.
   */
  async listImports(page = 1, limit = 20): Promise<{ data: ContactImportJob[]; total: number }> {
    return apiClient.get('/contacts/imports', { page, limit });
  }

  /**
   * A single import job.
   */
  async getImport(importId: string): Promise<ContactImportJob> {
    return apiClient.get(`/contacts/imports/${importId}`);
  }
}

export const contactImportService = new ContactImportService();
