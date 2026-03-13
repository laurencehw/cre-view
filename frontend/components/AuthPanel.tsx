'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';

export default function AuthPanel() {
  const { login, isAuthenticated, user, logout } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  if (isAuthenticated) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="text-gray-400 truncate max-w-[160px]">{user?.email ?? 'Logged in'}</span>
        <button
          type="button"
          onClick={logout}
          className="px-3 py-1.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-xs"
        >
          Sign out
        </button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (mode === 'register') {
        let res: Response;
        try {
          res = await fetch(`${apiUrl}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
        } catch (fetchErr) {
          throw new Error(`Network error reaching API (${apiUrl}). Check CORS_ORIGIN on the server.`);
        }
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? 'Registration failed');
        }
        // After successful registration, log in
      }
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 text-sm">
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        className="w-36 px-2 py-1.5 rounded-lg border border-gray-700 bg-gray-900/50 text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-brand-500"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
        minLength={6}
        className="w-28 px-2 py-1.5 rounded-lg border border-gray-700 bg-gray-900/50 text-gray-200 placeholder-gray-500 text-xs focus:outline-none focus:border-brand-500"
      />
      <button
        type="submit"
        disabled={loading}
        className="px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 disabled:bg-gray-800 disabled:text-gray-500 text-white text-xs font-medium transition-colors"
      >
        {loading ? '...' : mode === 'login' ? 'Sign in' : 'Register'}
      </button>
      <button
        type="button"
        onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
        className="text-xs text-gray-500 hover:text-gray-300 transition-colors whitespace-nowrap"
      >
        {mode === 'login' ? 'Register' : 'Sign in'}
      </button>
      {error && <span className="text-xs text-red-400 max-w-[150px] truncate" title={error}>{error}</span>}
    </form>
  );
}
