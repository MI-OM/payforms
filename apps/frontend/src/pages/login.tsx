'use client';

import { useState } from 'react';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/auth';

export default function LoginPage() {
  const router = useRouter();
  const { login, verifyTwoFactorLogin, isLoading, error } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!challengeToken && (!email || !password)) {
      setFormError('Email and password are required');
      return;
    }

    if (challengeToken && !twoFactorCode && !recoveryCode) {
      setFormError('Authentication code or recovery code is required');
      return;
    }

    try {
      if (challengeToken) {
        await verifyTwoFactorLogin(challengeToken, twoFactorCode || undefined, recoveryCode || undefined);
        router.push('/dashboard');
        return;
      }

      const response = await login(email, password);
      if (response.requires_two_factor && response.challenge_token) {
        setChallengeToken(response.challenge_token);
        setPassword('');
        return;
      }

      router.push('/dashboard');
    } catch (err: any) {
      setFormError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payforms</h1>
          <p className="text-gray-600 mt-2">Admin Dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {(formError || error) && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
              {formError || error}
            </div>
          )}

          {!challengeToken ? (
            <>
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@school.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={isLoading}
                />
                <div className="mt-2 text-right">
                  <a href="/forgot-password" className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    Forgot password?
                  </a>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                Enter the 6-digit code from your authenticator app. If you cannot access it, use one of your recovery codes.
              </div>

              <div>
                <label htmlFor="twoFactorCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Authentication Code
                </label>
                <input
                  id="twoFactorCode"
                  type="text"
                  inputMode="numeric"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value)}
                  placeholder="123456"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="recoveryCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Recovery Code
                </label>
                <input
                  id="recoveryCode"
                  type="text"
                  value={recoveryCode}
                  onChange={(e) => setRecoveryCode(e.target.value)}
                  placeholder="ABCD-EFGH"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                  disabled={isLoading}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400"
          >
            {isLoading ? 'Signing in...' : challengeToken ? 'Verify and Continue' : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 text-sm">
            Don't have an account?{' '}
            <a href="/register" className="text-blue-600 hover:text-blue-700 font-semibold">
              Register here
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
