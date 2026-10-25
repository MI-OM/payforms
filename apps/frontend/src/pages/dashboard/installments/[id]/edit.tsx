import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  installmentService,
  type InstallmentPlan,
  type InstallmentPlanItemInput,
} from '@/services/installmentService';
import { apiClient } from '@/services/api';

interface Form {
  id: string;
  title: string;
}

const EMPTY_ITEM: InstallmentPlanItemInput = {
  label: '',
  amount: 0,
  due_date: '',
};

export default function InstallmentPlanEditorPage() {
  const router = useRouter();
  const { id } = router.query;
  const isNew = id === 'new';

  const [name, setName] = useState('');
  const [formId, setFormId] = useState('');
  const [currency, setCurrency] = useState('NGN');
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [active, setActive] = useState(true);
  const [items, setItems] = useState<InstallmentPlanItemInput[]>([{ ...EMPTY_ITEM }]);
  const [forms, setForms] = useState<Form[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadForms();
    if (!isNew && id) loadPlan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew]);

  async function loadForms() {
    try {
      const res = await apiClient.get('/forms');
      setForms(res?.data ?? res ?? []);
    } catch {
      // forms list is optional for display purposes
    }
  }

  async function loadPlan() {
    try {
      setLoading(true);
      const plan: InstallmentPlan = await installmentService.getPlan(id as string);
      setName(plan.name);
      setFormId(plan.form_id);
      setCurrency(plan.currency);
      setTotalAmount(Number(plan.total_amount));
      setActive(plan.active);
      setItems(
        plan.items?.map(i => ({
          label: i.label,
          amount: Number(i.amount),
          due_date: i.due_date,
          penalty_rule: i.penalty_rule ?? undefined,
          order_index: i.order_index,
        })) ?? [{ ...EMPTY_ITEM }],
      );
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load plan');
    } finally {
      setLoading(false);
    }
  }

  function addItem() {
    setItems(prev => [...prev, { ...EMPTY_ITEM }]);
  }

  function removeItem(idx: number) {
    setItems(prev => prev.filter((_, i) => i !== idx));
  }

  function updateItem<K extends keyof InstallmentPlanItemInput>(
    idx: number,
    key: K,
    value: InstallmentPlanItemInput[K],
  ) {
    setItems(prev => prev.map((item, i) => (i === idx ? { ...item, [key]: value } : item)));
  }

  // Auto-compute total from items
  const itemsTotal = items.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

  async function handleSave() {
    setError(null);
    if (!name.trim()) { setError('Plan name is required'); return; }
    if (!formId) { setError('Please select a form'); return; }
    if (items.length === 0) { setError('At least one installment item is required'); return; }
    if (items.some(i => !i.label.trim() || !i.due_date)) {
      setError('All items need a label and due date');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        form_id: formId,
        name: name.trim(),
        currency,
        total_amount: totalAmount || itemsTotal,
        active,
        items: items.map((item, idx) => ({ ...item, order_index: idx })),
      };

      if (isNew) {
        await installmentService.createPlan(payload);
      } else {
        await installmentService.updatePlan(id as string, payload);
      }
      await router.push('/dashboard/installments');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to save plan');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/installments" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{isNew ? 'New Installment Plan' : 'Edit Plan'}</h1>
            <p className="text-sm text-gray-500">Define structured payment schedules for your contacts</p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm flex gap-2">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        <div className="bg-white rounded-xl shadow border border-gray-200 divide-y divide-gray-100">

          {/* Basic Info */}
          <div className="p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Plan Details</h2>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Plan Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Annual School Fees 2025"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Form *</label>
                <select
                  value={formId}
                  onChange={e => setFormId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="">— Select a form —</option>
                  {forms.map(f => (
                    <option key={f.id} value={f.id}>{f.title}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm bg-white"
                >
                  <option value="NGN">NGN — Naira</option>
                  <option value="USD">USD — Dollar</option>
                  <option value="GBP">GBP — Pound</option>
                  <option value="EUR">EUR — Euro</option>
                  <option value="GHS">GHS — Cedi</option>
                  <option value="KES">KES — Shilling</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Total Amount
                  <span className="ml-2 text-xs text-gray-400 font-normal">(or leave 0 to sum items)</span>
                </label>
                <input
                  type="number"
                  min={0}
                  value={totalAmount || ''}
                  onChange={e => setTotalAmount(Number(e.target.value))}
                  placeholder={itemsTotal > 0 ? String(itemsTotal) : '0'}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>
              <div className="flex flex-col justify-end pb-0.5">
                <label className="flex items-center gap-3 cursor-pointer">
                  <div
                    onClick={() => setActive(v => !v)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${active ? 'bg-blue-600' : 'bg-gray-300'}`}
                  >
                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${active ? 'translate-x-7' : 'translate-x-1'}`} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">Active</span>
                </label>
              </div>
            </div>
          </div>

          {/* Installment Items */}
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Installment Schedule</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Items total: <strong>{currency} {itemsTotal.toLocaleString()}</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={addItem}
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 font-medium hover:text-blue-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Installment
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-3 items-start p-4 bg-gray-50 rounded-lg border border-gray-200">
                  {/* Order badge */}
                  <div className="col-span-1 flex items-center justify-center pt-2">
                    <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                  </div>
                  {/* Label */}
                  <div className="col-span-4">
                    <label className="block text-xs text-gray-500 mb-1">Label *</label>
                    <input
                      type="text"
                      value={item.label}
                      onChange={e => updateItem(idx, 'label', e.target.value)}
                      placeholder="e.g. First Term"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {/* Amount */}
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Amount ({currency}) *</label>
                    <input
                      type="number"
                      min={0}
                      value={item.amount || ''}
                      onChange={e => updateItem(idx, 'amount', Number(e.target.value))}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {/* Due date */}
                  <div className="col-span-3">
                    <label className="block text-xs text-gray-500 mb-1">Due Date *</label>
                    <input
                      type="date"
                      value={item.due_date}
                      onChange={e => updateItem(idx, 'due_date', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {/* Remove */}
                  <div className="col-span-1 flex items-center justify-center pt-6">
                    <button
                      type="button"
                      onClick={() => removeItem(idx)}
                      disabled={items.length === 1}
                      className="p-1 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="p-6 flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
            >
              {saving && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {saving ? 'Saving…' : (isNew ? 'Create Plan' : 'Save Changes')}
            </button>
            <Link href="/dashboard/installments" className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium">
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
