'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { apiClient } from '@/services/api';

type VerificationState = 'idle' | 'verifying' | 'success' | 'error';

export default function VerifyOrganizationEmailPage() {
  const router = useRouter();
  const token = useMemo(() => {
    const value = router.query.token;
    if (Array.isArray(value)) return value[0] || '';
    return value || '';
  }, [router.query.token]);

  const [state, setState] = useState<VerificationState>('idle');
  const [message, setMessage] = useState('Preparing email verification...');

  useEffect(() => {
    const verify = async () => {
      if (!token) {
        setState('error');
        setMessage('Verification token is missing. Use the link from your email.');
        return;
      }

      setState('verifying');
      setMessage('Verifying your organization email...');

      try {
        await apiClient.verifyOrganizationEmail(token);
        setState('success');
        setMessage('Organization email verified successfully.');
      } catch (err: any) {
        setState('error');
        setMessage(err.response?.data?.message || 'Unable to verify organization email.');
      }
    };

    if (router.isReady) {
      verify();
    }
  }, [router.isReady, token]);

  const boxStyle =
    state === 'success'
      ? 'bg-green-50 border-green-200 text-green-700'
      : state === 'error'
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-blue-50 border-blue-200 text-blue-700';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Organization Email Verification</h1>
          <p className="text-gray-600 mt-2">Payforms account security</p>
        </div>

        <div className={`border rounded-lg p-4 text-sm ${boxStyle}`}>
          {message}
        </div>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center space-y-2">
          <a href="/login" className="block text-blue-600 hover:text-blue-700 font-semibold text-sm">
            Go to login
          </a>
          <a href="/dashboard/settings" className="block text-blue-600 hover:text-blue-700 font-semibold text-sm">
            Open dashboard settings
          </a>
        </div>
      </div>
    </div>
  );
}
