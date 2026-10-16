'use client'

import { useEffect, useState } from 'react'
import { useAuthStore } from '@/store/auth'
import { apiClient } from '@/services/api'

interface OrgSettings {
  id: string
  name: string
  email: string
  email_verified: boolean
  logo_url?: string
  require_contact_login: boolean
  // Negotiated limits from Platform Admin
  contacts_limit?: number
  forms_limit?: number
  staff_users_limit?: number
  monthly_submissions_limit?: number
  monthly_email_sends_limit?: number
  storage_gb_limit?: number
  plan?: string
  notes?: string
}

// Types for entitlements from platform API
interface Entitlements {
  organization_id: string
  plan: string
  plan_name: string
  // null when the platform has not set any negotiated overrides
  overrides: {
    contacts_limit: number | null
    forms_limit: number | null
    staff_users_limit: number | null
    monthly_submissions_limit: number | null
    monthly_email_sends_limit: number | null
    storage_gb_limit: number | null
    notes: string | null
  } | null
  effective: {
    soft_limits: {
      contacts: number
      forms: number
      staff_users: number
      monthly_submissions: number
      monthly_email_sends: number
      storage_gb: number
    }
    hard_limits: {
      contacts: number
      forms: number
      staff_users: number
      monthly_submissions: number
      monthly_email_sends: number
      storage_gb: number
    }
  }
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<OrgSettings | null>(null)
  const [entitlements, setEntitlements] = useState<Entitlements | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [resendingVerification, setResendingVerification] = useState(false)
  const [success, setSuccess] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [statusError, setStatusError] = useState('')

  // Load organization settings
  const loadSettings = async () => {
    try {
      const response = await apiClient.getOrganizationSettings()
      setSettings(response)
    } catch (error) {
      console.error('Failed to load settings:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load entitlements (negotiated limits from Platform Admin).
  // Tenant-scoped route: resolves the organization from the JWT. The
  // /platform/organizations/:id/entitlements equivalent is SUPER-only and 403s
  // a tenant token.
  const loadEntitlements = async () => {
    if (!user?.organization_id) return
    try {
      const response = await apiClient.get('/organization/entitlements')
      setEntitlements(response.data)
    } catch (error) {
      console.error('Failed to load entitlements:', error)
    }
  }

  useEffect(() => {
    if (user) {
      loadSettings()
      loadEntitlements()
    }
  }, [user])

  const handleSave = async () => {
    if (!settings) return
    setSaving(true)
    setSuccess(false)
    setStatusMessage('')
    setStatusError('')

    try {
      await apiClient.updateOrganization({
        name: settings.name,
        email: settings.email,
        require_contact_login: settings.require_contact_login,
      })
      const refreshed = await apiClient.getOrganizationSettings()
      setSettings(refreshed)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch (error) {
      setStatusError('Failed to update settings')
      console.error('Failed to update settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleResendVerification = async () => {
    setResendingVerification(true)
    setStatusMessage('')
    setStatusError('')

    try {
      await apiClient.requestOrganizationEmailVerification()
      setStatusMessage('Verification email sent. Check your inbox.')
    } catch (error: any) {
      setStatusError(error.response?.data?.message || 'Failed to resend verification email')
    } finally {
      setResendingVerification(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-4 py-8">
        {success && (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            Settings updated successfully!
          </div>
        )}
        {statusMessage && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700 text-sm">
            {statusMessage}
          </div>
        )}
        {statusError && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
            {statusError}
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading settings...</div>
          ) : settings ? (
            <>
              <div className="p-8 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900 mb-6">Organization Settings</h2>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Organization Name</label>
                    <input
                      type="text"
                      value={settings.name}
                      onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                    <input
                      type="email"
                      value={settings.email}
                      onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <div className="mt-2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${settings.email_verified ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}
                      >
                        {settings.email_verified ? 'Verified' : 'Not verified'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="loginRequired"
                      checked={settings.require_contact_login}
                      onChange={(e) => setSettings({ ...settings, require_contact_login: e.target.checked })}
                      className="h-4 w-4 text-blue-600 rounded"
                    />
                    <label htmlFor="loginRequired" className="ml-3 block text-sm text-gray-700">
                      Require contacts to login before submitting forms
                    </label>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 flex justify-end gap-4">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 font-medium"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">Failed to load settings</div>
          )}
        </div>
      </div>

      {/* NEW: Entitlements/Billing Section - shows negotiated limits from Platform Admin */}
      {entitlements && (
        <div className="mt-8 bg-white rounded-lg shadow p-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Negotiated Limits</h2>
          <p className="text-sm text-gray-600 mb-4">
            Limits set by the Platform Admin. Leave empty to inherit plan defaults.
          </p>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Contacts</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Effective soft</span>
                  <span className="font-medium text-gray-900">{entitlements.effective.soft_limits.contacts}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Plan override</span>
                  <span className="text-sm">{entitlements.overrides?.contacts_limit ?? 'inherit'}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Forms</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Effective soft</span>
                  <span className="font-medium text-gray-900">{entitlements.effective.soft_limits.forms}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Plan override</span>
                  <span className="text-sm">{entitlements.overrides?.forms_limit ?? 'inherit'}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Staff Seats</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Effective soft</span>
                  <span className="font-medium text-gray-900">{entitlements.effective.soft_limits.staff_users}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Plan override</span>
                  <span className="text-sm">{entitlements.overrides?.staff_users_limit ?? 'inherit'}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Emails / Month</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Effective soft</span>
                  <span className="font-medium text-gray-900">{entitlements.effective.soft_limits.monthly_email_sends}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Plan override</span>
                  <span className="text-sm">{entitlements.overrides?.monthly_email_sends_limit ?? 'inherit'}</span>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Storage (GB)</label>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-sm text-gray-500">Effective soft</span>
                  <span className="font-medium text-gray-900">{entitlements.effective.soft_limits.storage_gb}</span>
                </div>
                <div>
                  <span className="text-sm text-gray-400">Plan override</span>
                  <span className="text-sm">{entitlements.overrides?.storage_gb_limit ?? 'inherit'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-8 bg-white rounded-lg shadow p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Email Verification</h2>
        <p className="text-gray-600 mb-4">
          Keep your organization email verified to ensure reliable password recovery and account notifications.
        </p>
        {settings?.email_verified ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-700 text-sm">
            Your organization email is verified.
          </div>
        ) : user?.role !== 'ADMIN' ? (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-700 text-sm">
            Organization email is not verified. Ask an admin to resend verification.
          </div>
        ) : (
          <button
            onClick={handleResendVerification}
            disabled={resendingVerification}
            className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition disabled:bg-gray-400 text-sm font-medium"
          >
            {resendingVerification ? 'Sending...' : 'Resend Verification Email'}
          </button>
        )}
      </div>

      <div className="mt-8 bg-white rounded-lg shadow p-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Paystack Integration</h2>
        <p className="text-gray-600 mb-4">
          Configure your Paystack API keys to enable payment processing. Your keys are encrypted and never shared.
        </p>
        <a href="#" className="text-blue-600 hover:text-blue-700 font-medium">
          Configure Paystack Keys →
        </a>
      </div>
    </div>
  )
}