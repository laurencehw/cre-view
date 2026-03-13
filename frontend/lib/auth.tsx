'use client';

import { createContext, useContext, useState, useCallback, useEffect } from 'react';

interface AuthState {
  token: string | null;
  user: { sub: string; email?: string; role?: string } | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  /** Returns headers object with Authorization if logged in */
  authHeaders: () => Record<string, string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'cre_view_token';

function parseJwtPayload(token: string): AuthState['user'] {
  try {
    const base64 = token.split('.')[1];
    const json = atob(base64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ token: null, user: null });

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const user = parseJwtPayload(stored);
      if (user) {
        setAuthState({ token: stored, user });
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Login failed');
    }

    const { token } = await res.json();
    const user = parseJwtPayload(token);
    localStorage.setItem(STORAGE_KEY, token);
    setAuthState({ token, user });
  }, [apiUrl]);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setAuthState({ token: null, user: null });
  }, []);

  const authHeaders = useCallback((): Record<string, string> => {
    if (!authState.token) return {};
    return { Authorization: `Bearer ${authState.token}` };
  }, [authState.token]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        logout,
        isAuthenticated: !!authState.token,
        authHeaders,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
