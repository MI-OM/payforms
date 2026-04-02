'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';
import { apiClient } from '@/services/api';

interface Organization {
  id: string;
  name: string;
  email: string;
  email_verified: boolean;
  logo_url?: string;
  require_contact_login: boolean;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, logout, fetchCurrentUser } = useAuthStore();
  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!user) {
        await fetchCurrentUser();
      }
    };
    checkAuth();
  }, []);

  useEffect(() => {
    const loadOrg = async () => {
      if (user) {
        try {
          const response = await apiClient.getOrganization();
          setOrg(response);
        } catch (error) {
          console.error('Failed to load organization:', error);
        } finally {
          setLoading(false);
        }
      }
    };
    loadOrg();
  }, [user]);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            {org?.logo_url && <img src={org.logo_url} alt="Logo" className="h-8" />}
            <h1 className="text-2xl font-bold text-gray-900">{org?.name || 'Payforms'}</h1>
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-gray-600 text-sm">{user.email}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition text-sm font-medium"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Sidebar + Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 flex gap-8">
        {/* Sidebar */}
        <aside className="w-64">
          <nav className="space-y-2">
            <a
              href="/dashboard"
              className="block px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium"
            >
              Dashboard
            </a>
            <a
              href="/dashboard/forms"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Forms
            </a>
            <a
              href="/dashboard/contacts"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Contacts
            </a>
            <a
              href="/dashboard/groups"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Groups
            </a>
            <a
              href="/dashboard/payments"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Payments
            </a>
            <a
              href="/dashboard/settings"
              className="block px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Settings
            </a>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1">
          <div className="bg-white rounded-lg shadow p-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Welcome to Payforms</h2>
            <p className="text-gray-600 mb-8">
              Manage your payment forms, contacts, and track payments all in one place.
            </p>

            {!loading && org && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-blue-50 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Organization</div>
                  <div className="text-2xl font-bold text-gray-900">{org.name}</div>
                </div>
                <div className="bg-green-50 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Status</div>
                  <div className="text-2xl font-bold text-gray-900">Active</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Login Required</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {org.require_contact_login ? 'Yes' : 'No'}
                  </div>
                </div>
                <div className="bg-amber-50 rounded-lg p-6">
                  <div className="text-sm text-gray-600 mb-2">Email Verification</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {org.email_verified ? 'Verified' : 'Pending'}
                  </div>
                </div>
              </div>
            )}

            {loading && <p className="text-gray-500">Loading organization data...</p>}

            {!loading && org && !org.email_verified && (
              <div className="mt-6 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm">
                Organization email is not verified.
                {' '}
                <a href="/dashboard/settings" className="font-semibold underline">
                  Go to settings
                </a>
                {' '}
                to resend verification.
              </div>
            )}

            <div className="mt-8 pt-8 border-t border-gray-200">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Quick Start</h3>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mr-3">
                    1
                  </span>
                  <span>Create your first form</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mr-3">
                    2
                  </span>
                  <span>Import or create contacts</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mr-3">
                    3
                  </span>
                  <span>Assign forms to contact groups</span>
                </li>
                <li className="flex items-start">
                  <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-blue-100 text-blue-600 text-sm font-semibold mr-3">
                    4
                  </span>
                  <span>Track payments and reports</span>
                </li>
              </ul>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
