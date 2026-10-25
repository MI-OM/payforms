import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  contactImportService,
  type ContactImportJob,
  type ImportValidationResult,
} from '@/services/contactImportService';
import {
  importTemplateService,
  type ImportTemplate,
} from '@/services/importTemplateService';
import { AlertCircle, Upload, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';

const SAMPLE_CSV = `first_name,last_name,email,phone
Jane,Doe,jane@example.com,+2348012345678`;

export default function ContactImportPage() {
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string>('');
  const [csv, setCsv] = useState('');
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<ImportValidationResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recent, setRecent] = useState<ContactImportJob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [templateList, imports] = await Promise.all([
        importTemplateService.listTemplates(),
        contactImportService.listImports(1, 10),
      ]);
      setTemplates(templateList || []);

      const defaultTemplate = (templateList || []).find((t) => t.is_default);
      if (defaultTemplate) {
        setTemplateId(defaultTemplate.id);
      }

      setRecent(imports?.data || []);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load import templates');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      setCsv(String(reader.result || ''));
      setResult(null);
      setNotice(null);
    };
    reader.readAsText(file);
  };

  const handleValidate = async () => {
    if (!csv.trim()) {
      setError('Paste or upload a CSV first');
      return;
    }

    try {
      setValidating(true);
      setError(null);
      setNotice(null);
      const validation = await contactImportService.validateCsv(csv, templateId || null);
      setResult(validation);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Validation failed');
      setResult(null);
    } finally {
      setValidating(false);
    }
  };

  const handleCommit = async () => {
    if (!result?.import_id) {
      return;
    }

    try {
      setCommitting(true);
      setError(null);
      const committed = await contactImportService.commit(result.import_id);
      setNotice(`Imported ${committed.created_count} contact(s).`);
      setResult(null);
      setCsv('');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Import failed');
    } finally {
      setCommitting(false);
    }
  };

  const canCommit = result?.status === 'VALIDATED' && result.failure_count === 0;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/dashboard/contacts"
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to contacts
            </Link>
            <h1 className="text-3xl font-bold text-gray-900">Import Contacts</h1>
            <p className="mt-2 text-gray-600">
              Upload a CSV, validate it against a template, then commit the import.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {notice && (
          <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
            <p className="text-sm text-green-800">{notice}</p>
          </div>
        )}

        {/* Step 1 — template */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">1. Choose a template</h2>
          <p className="text-sm text-gray-600 mb-4">
            The template decides which fields are required. Leave it on the default to use
            your organization&apos;s default template.
          </p>
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className="w-full md:w-1/2 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Default template</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
                {template.is_default ? ' (default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Step 2 — CSV */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-1">2. Provide the CSV</h2>
          <p className="text-sm text-gray-600 mb-4">
            The first row must be the header row. Columns: first_name, last_name, email,
            phone, student_id, external_id, guardian_name, guardian_email, guardian_phone,
            group_ids, groups, group_paths.
          </p>

          <div className="flex flex-wrap items-center gap-3 mb-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFile(file);
                }
                e.target.value = '';
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
            >
              <Upload className="h-4 w-4" />
              Choose CSV file
            </button>
            <button
              onClick={() => {
                setCsv(SAMPLE_CSV);
                setResult(null);
              }}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition"
            >
              Use sample
            </button>
          </div>

          <textarea
            value={csv}
            onChange={(e) => {
              setCsv(e.target.value);
              setResult(null);
            }}
            rows={8}
            placeholder={SAMPLE_CSV}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <button
            onClick={handleValidate}
            disabled={validating}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {validating ? 'Validating...' : 'Validate import'}
          </button>
        </div>

        {/* Step 3 — result */}
        {result && (
          <div className="bg-white rounded-lg shadow border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Review and commit</h2>

            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Total rows
                </p>
                <p className="text-2xl font-bold text-gray-900">{result.total_count}</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Valid
                </p>
                <p className="text-2xl font-bold text-green-700">{result.success_count}</p>
              </div>
              <div className="bg-red-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  With errors
                </p>
                <p className="text-2xl font-bold text-red-700">{result.failure_count}</p>
              </div>
            </div>

            {result.template && (
              <p className="text-sm text-gray-600 mb-4">
                Validated against <span className="font-medium">{result.template.name}</span>.
              </p>
            )}

            {result.errors.length > 0 && (
              <div className="border border-red-200 rounded-lg overflow-hidden mb-6">
                <table className="min-w-full divide-y divide-red-100">
                  <thead className="bg-red-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-red-800 uppercase w-24">
                        Row
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-red-800 uppercase">
                        Problems
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50 bg-white">
                    {result.errors.slice(0, 50).map((rowError) => (
                      <tr key={rowError.row_index}>
                        <td className="px-4 py-2 text-sm text-gray-700">
                          {rowError.row_index >= 0 ? rowError.row_index + 1 : '—'}
                        </td>
                        <td className="px-4 py-2 text-sm text-red-700">
                          {rowError.errors.join(', ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {result.errors.length > 50 && (
                  <p className="px-4 py-2 text-xs text-gray-500 bg-gray-50">
                    Showing the first 50 of {result.errors.length} problematic rows.
                  </p>
                )}
              </div>
            )}

            {canCommit ? (
              <button
                onClick={handleCommit}
                disabled={committing}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {committing ? 'Importing...' : `Import ${result.success_count} contact(s)`}
              </button>
            ) : (
              <div className="flex items-start gap-2 text-sm text-red-700">
                <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <p>
                  Fix the rows listed above and validate again — an import is only committed
                  when every row passes.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recent imports */}
        <div className="bg-white rounded-lg shadow border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Recent imports</h2>
          </div>
          {recent.length === 0 ? (
            <p className="p-6 text-center text-gray-500 text-sm">No imports yet.</p>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Rows
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    Imported
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                    When
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 text-sm text-gray-900">{job.status}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{job.total_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{job.success_count}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(job.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
