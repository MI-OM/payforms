import { useState, useEffect } from 'react';
import Link from 'next/link';
import { installmentService, type InstallmentPlan, type MarketFlags } from '@/services/installmentService';

export default function InstallmentPlansPage() {
  const [plans, setPlans] = useState<InstallmentPlan[]>([]);
  const [flags, setFlags] = useState<MarketFlags | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const f = await installmentService.getFlags();
      setFlags(f);
      if (f.installments_enabled) {
        const p = await installmentService.listPlans();
        setPlans(p ?? []);
      }
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  async function enable() {
    try {
      setEnabling(true);
      const f = await installmentService.enableInstallments();
      setFlags(f);
      const p = await installmentService.listPlans();
      setPlans(p ?? []);
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Failed to enable feature');
    } finally {
      setEnabling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="h-8 w-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  // Feature not enabled
  if (flags && !flags.installments_enabled) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow border border-gray-200 p-10 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Installment Plans</h2>
          <p className="text-gray-600 mb-8">
            Enable installment plans to let contacts pay in structured schedules with defined due dates and amounts.
          </p>
          <button
            onClick={enable}
            disabled={enabling}
            className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:opacity-50"
          >
            {enabling ? 'Enabling…' : 'Enable Installment Plans'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Installment Plans</h1>
            <p className="text-gray-600 mt-1">Create structured payment schedules for your forms</p>
          </div>
          <Link
            href="/dashboard/installments/new"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2.5 rounded-lg font-medium hover:bg-blue-700 transition"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Plan
          </Link>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">{error}</div>
        )}

        {/* Empty */}
        {plans.length === 0 && (
          <div className="bg-white rounded-xl shadow border border-gray-200 p-16 text-center">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No plans yet</h3>
            <p className="text-gray-500 mb-6">Create your first installment plan to get started</p>
            <Link
              href="/dashboard/installments/new"
              className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition"
            >
              Create Plan
            </Link>
          </div>
        )}

        {/* Plans grid */}
        {plans.length > 0 && (
          <div className="grid gap-4">
            {plans.map(plan => (
              <div key={plan.id} className="bg-white rounded-xl shadow border border-gray-200 p-6 hover:shadow-md transition">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${plan.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {plan.active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-6 mt-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Total Amount</p>
                        <p className="text-xl font-bold text-gray-900 mt-0.5">
                          {plan.currency} {Number(plan.total_amount).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Currency</p>
                        <p className="text-lg font-semibold text-gray-900 mt-0.5">{plan.currency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Created</p>
                        <p className="text-sm text-gray-700 mt-0.5">{new Date(plan.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    <Link
                      href={`/dashboard/installments/${plan.id}/accounts`}
                      className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                      Accounts
                    </Link>
                    <Link
                      href={`/dashboard/installments/${plan.id}/edit`}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Dunning campaigns link */}
        <div className="mt-10 border-t border-gray-200 pt-8">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Arrears & Dunning Campaigns</h2>
              <p className="text-sm text-gray-500 mt-1">Manage overdue payment follow-up campaigns</p>
            </div>
            <Link
              href="/dashboard/installments/campaigns"
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-medium"
            >
              View Campaigns →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
