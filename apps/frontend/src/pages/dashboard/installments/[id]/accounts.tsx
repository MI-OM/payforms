import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import {
  installmentService,
  type InstallmentPlan,
  type ContactInstallmentAccount,
} from '@/services/installmentService';
import { apiClient } from '@/services/api';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
}

const STATUS_STYLES: Record<string, string> = {
  ACTIVE: 'bg-blue-100 text-blue-800',
  COMPLETED: 'bg-green-100 text-green-800',
  OVERDUE: 'bg-red-100 text-red-800',
};

export default function InstallmentAccountsPage() {
  const router = useRouter();
  const { id: planId } = router.query;

  const [plan, setPlan] = useState<InstallmentPlan | null>(null);
  const [accounts, setAccounts] = useState<ContactInstallmentAccount[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [result, setResult] = useState<{ assigned: number; skipped_existing: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'accounts' | 'assign'>('accounts');

  useEffect(() => {
    if (planId) load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planId]);

  async function load() {
    try {
      setLoading(true);
      const [p, a, c] = await Promise.all([
        installmentService.getPlan(planId as string),
        installmentService.listAccounts(planId as string),
        apiClient.get('/contacts').then((r: any) => r?.data ?? r ?? []),
      ]);
      setPlan(p);
      setAccounts(a ?? []);
      setContacts(c);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function handleAssign() {
    if (selectedIds.size === 0) return;
    try {
      setAssigning(true);
      setResult(null);
      const res = await installmentService.assignContacts(planId as string, Array.from(selectedIds));
      setResult({ assigned: res.assigned, skipped_existing: res.skipped_existing });
      setSelectedIds(new Set());
      // refresh accounts
      const updated = await installmentService.listAccounts(planId as string);
      setAccounts(updated ?? []);
      setTab('accounts');
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to assign contacts');
    } finally {
      setAssigning(false);
    }
  }

  function toggleContact(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  // Already-assigned contact IDs
  const assignedIds = new Set(accounts.map(a => a.contact_id));

  const filteredContacts = contacts.filter(c => {
    const name = `${c.first_name} ${c.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
  });

  const contactMap = new Map(contacts.map(c => [c.id, c]));

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Link href="/dashboard/installments" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{plan?.name}</h1>
            <p className="text-sm text-gray-500">
              {plan?.currency} {Number(plan?.total_amount).toLocaleString()} · {accounts.length} enrolled
            </p>
          </div>
        </div>

        {/* Error */}
        {error && <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>}

        {/* Success */}
        {result && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            ✓ Assigned {result.assigned} contacts.
            {result.skipped_existing > 0 && ` ${result.skipped_existing} already enrolled were skipped.`}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-lg w-fit">
          {(['accounts', 'assign'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition ${tab === t ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'accounts' ? `Enrolled (${accounts.length})` : 'Assign Contacts'}
            </button>
          ))}
        </div>

        {/* Tab: Accounts */}
        {tab === 'accounts' && (
          <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden">
            {accounts.length === 0 ? (
              <div className="p-16 text-center">
                <p className="text-gray-500 mb-4">No contacts enrolled yet</p>
                <button onClick={() => setTab('assign')} className="text-blue-600 font-medium hover:underline text-sm">
                  Assign contacts →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Contact</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Outstanding</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                    <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wide">Enrolled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {accounts.map(acc => {
                    const contact = contactMap.get(acc.contact_id);
                    return (
                      <tr key={acc.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          {contact ? (
                            <div>
                              <p className="font-medium text-gray-900">{contact.first_name} {contact.last_name}</p>
                              <p className="text-xs text-gray-500">{contact.email}</p>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">{acc.contact_id.slice(0, 8)}…</span>
                          )}
                        </td>
                        <td className="px-6 py-4 font-semibold text-gray-900">
                          {plan?.currency} {Number(acc.outstanding_amount).toLocaleString()}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[acc.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {acc.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500 text-xs">
                          {new Date(acc.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab: Assign */}
        {tab === 'assign' && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm text-gray-600">{selectedIds.size} selected</p>
              <input
                type="text"
                placeholder="Search contacts…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg mb-4">
              {filteredContacts.length === 0 ? (
                <p className="text-center text-gray-400 py-8 text-sm">No contacts found</p>
              ) : (
                filteredContacts.map(c => {
                  const already = assignedIds.has(c.id);
                  const selected = selectedIds.has(c.id);
                  return (
                    <div
                      key={c.id}
                      onClick={() => !already && toggleContact(c.id)}
                      className={`flex items-center gap-3 px-4 py-3 transition ${already ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
                    >
                      <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${selected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.first_name} {c.last_name}</p>
                        <p className="text-xs text-gray-500 truncate">{c.email}</p>
                      </div>
                      {already && <span className="text-xs text-gray-400 flex-shrink-0">Already enrolled</span>}
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || assigning}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {assigning && <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              {assigning ? 'Assigning…' : `Assign ${selectedIds.size > 0 ? selectedIds.size : ''} Contact${selectedIds.size !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
