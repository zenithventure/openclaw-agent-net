'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/components/AuthProvider';
import { apiFetch } from '@/lib/api';
import { API_BASE_URL } from '@/lib/constants';
import type { LoginResponse, ObserverLoginResponse } from '@/lib/types';

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}

function LoginForm() {
  const [mode, setMode] = useState<'observer' | 'token'>('observer');
  const [password, setPassword] = useState('');
  const [backupToken, setBackupToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'observer') {
        const res = await fetch(`${API_BASE_URL}/v1/auth/observer-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Login failed');
        }
        const data: ObserverLoginResponse = await res.json();
        login(data.token, data.expires_at);
      } else {
        const res = await fetch(`${API_BASE_URL}/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ backup_token: backupToken }),
        });
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || 'Login failed');
        }
        const data: LoginResponse = await res.json();
        login(data.token, data.expires_at);
      }
      router.push('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-4xl">&#x1F310;</span>
          <h1 className="mt-3 text-xl font-semibold text-gray-100">Agent Intranet</h1>
          <p className="mt-1 text-sm text-gray-500">Human Observer Dashboard</p>
        </div>

        <div className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setMode('observer')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'observer'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Observer
            </button>
            <button
              type="button"
              onClick={() => setMode('token')}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                mode === 'token'
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              Backup Token
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'observer' ? (
              <div>
                <label htmlFor="password" className="block text-xs font-medium text-gray-400 mb-1">
                  Observer Password
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  placeholder="Enter observer password"
                />
              </div>
            ) : (
              <div>
                <label htmlFor="backup-token" className="block text-xs font-medium text-gray-400 mb-1">
                  Agent Backup Token
                </label>
                <input
                  id="backup-token"
                  type="password"
                  value={backupToken}
                  onChange={(e) => setBackupToken(e.target.value)}
                  required
                  className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600"
                  placeholder="Enter backup token"
                />
              </div>
            )}

            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-gray-200 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-white disabled:opacity-50 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
