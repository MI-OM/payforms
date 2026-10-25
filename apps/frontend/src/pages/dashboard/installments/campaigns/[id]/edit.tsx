import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { installmentService, type DunningCampaign, type CreateCampaignDto } from '@/services/installmentService';

const STATUSES: DunningCampaign['status'][] = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'];
const FREQUENCIES: DunningCampaign['execution_frequency'][] = ['MANUAL', 'DAILY', 'WEEKLY', 'MONTHLY'];

export default function CampaignEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';

  const [form, setForm] = useState<CreateCampaignDto>({
    name: '',
    description: '',
    status: 'DRAFT',
    min_days_overdue: 7,
    max_days_overdue: 365,
    min_outstanding_amount: '0',
    execution_frequency: 'MANUAL',
  });

  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && id) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  async function load() {
    try {
      setLoading(true);
      const c = await installmentService.getCampaign(id as string);
      setForm({
        name: c.name,
        description: c.description ?? '',
        status: c.status,
        min_days_overdue: c.min_days_overdue,
        max_days_overdue: c.max_days_overdue,
        min_outstanding_amount: c.min_outstanding_amount,
        execution_frequency: c.execution_frequency,
      });
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load campaign');
    } finally {
      setLoading(false);
    }
  }

  function set<K extends keyof CreateCampaignDto>(key: K, value: CreateCampaignDto[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    if (!form.name.trim()) { setError('Campaign name is required'); return; }
    if ((form.min_days_overdue ?? 0) > (form.max_days_overdue ?? 365)) {
      setError('Min days overdue cannot exceed max days overdue');
      return;
    }
    try {
      setSaving(true);
      if (isNew) {
        await installmentService.createCampaign(form);
      } else {
        await installmentService.updateCampaign(id as string, form);
      }
      await router.push('/dashboard/installments/campaigns');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">

        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/installments/campaigns" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Dunning Campaign' : 'Edit Campaign'}</h1>
            <p className="text-sm text-gray-500">Configure arrears follow-up rules</p>
          </div>
        </div>

        {error && <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

        <div className="bg-white rounded-xl shadow border border-gray-200 divide-y divide-gray-100">

          {/* Basic info */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Campaign Details</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="e.g. 30-Day Overdue Notice"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
              <textarea
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                placeholder="Optional description…"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
                <select
                  value={form.status}
                  onChange={e => set('status', e.target.value as DunningCampaign['status'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Run Frequency</label>
                <select
                  value={form.execution_frequency}
                  onChange={e => set('execution_frequency', e.target.value as DunningCampaign['execution_frequency'])}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                >
                  {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Eligibility rules */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Eligibility Rules</h2>
            <p className="text-xs text-gray-500">Contacts are eligible if their overdue days fall within the range AND their outstanding amount meets the minimum.</p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Days Overdue</label>
                <input
                  type="number"
                  min={0}
                  value={form.min_days_overdue}
                  onChange={e => set('min_days_overdue', Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Max Days Overdue</label>
                <input
                  type="number"
                  min={0}
                  value={form.max_days_overdue}
                  onChange={e => set('max_days_overdue', Number(e.target.value))}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Min Outstanding Amount</label>
              <input
                type="number"
                min={0}
                value={form.min_outstanding_amount}
                onChange={e => set('min_outstanding_amount', e.target.value)}
                placeholder="0"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-400 mt-1">Leave 0 to include all overdue contacts regardless of amount</p>
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-orange-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-orange-700 transition disabled:opacity-50"
            >
              {saving && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : isNew ? 'Create Campaign' : 'Save Changes'}
            </button>
            <Link href="/dashboard/installments/campaigns" className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
