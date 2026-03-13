'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { supabase, supabaseEnabled } from './supabase';

interface AuthState {
  token: string | null;
  user: { sub: string; email?: string; role?: string; exp?: number } | null;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  /** Returns headers object with Authorization if logged in */
  authHeaders: () => Record<string, string>;
  /** Whether Supabase auth is active */
  isSupabase: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'cre_view_token';

function parseJwtPayload(token: string): AuthState['user'] {
  try {
    let base64 = token.split('.')[1];
    // Convert base64url to standard base64 and add padding if needed
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4 !== 0) base64 += '=';
    const json = atob(base64);
    const payload = JSON.parse(json);
    // Validate required claims
    if (typeof payload.sub !== 'string') return null;
    // Reject expired tokens so stale localStorage entries don't fake auth
    if (typeof payload.exp === 'number' && isFinite(payload.exp) && payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

// ─── Supabase Auth Provider ─────────────────────────────────────────────────

function SupabaseAuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({ token: null, user: null });

  // Listen for Supabase auth state changes (handles session restore, refresh, etc.)
  useEffect(() => {
    if (!supabase) return;

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthState({
          token: session.access_token,
          user: {
            sub: session.user.id,
            email: session.user.email,
            role: session.user.role ?? 'authenticated',
          },
        });
      }
    });

    // Subscribe to auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setAuthState({
          token: session.access_token,
          user: {
            sub: session.user.id,
            email: session.user.email,
            role: session.user.role ?? 'authenticated',
          },
        });
      } else {
        setAuthState({ token: null, user: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const register = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const logout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
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
        register,
        logout,
        isAuthenticated: !!authState.token,
        authHeaders,
        isSupabase: true,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Custom JWT Auth Provider (original) ────────────────────────────────────

function CustomAuthProvider({ children }: { children: React.ReactNode }) {
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
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(`Network error reaching API (${apiUrl}). Check CORS_ORIGIN on the server.`);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Login failed');
    }

    const { token } = await res.json();
    const user = parseJwtPayload(token);
    localStorage.setItem(STORAGE_KEY, token);
    setAuthState({ token, user });
  }, [apiUrl]);

  const register = useCallback(async (email: string, password: string) => {
    let res: Response;
    try {
      res = await fetch(`${apiUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error(`Network error reaching API (${apiUrl}). Check CORS_ORIGIN on the server.`);
    }

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? 'Registration failed');
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

  // Auto-refresh: schedule a refresh 5 minutes before the token expires
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }

    if (!authState.token || !authState.user?.exp) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const refreshAt = authState.user.exp - 300; // 5 minutes before expiry
    const delayMs = Math.max((refreshAt - nowSec) * 1000, 0);

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/auth/refresh`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${authState.token}` },
        });
        if (!res.ok) throw new Error('Refresh failed');
        const { token } = await res.json();
        const user = parseJwtPayload(token);
        if (user) {
          localStorage.setItem(STORAGE_KEY, token);
          setAuthState({ token, user });
        }
      } catch {
        // Refresh failed — user will be logged out when token naturally expires
      }
    }, delayMs);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [authState.token, authState.user?.exp, apiUrl]);

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        login,
        register,
        logout,
        isAuthenticated: !!authState.token,
        authHeaders,
        isSupabase: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Exports ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (supabaseEnabled) {
    return <SupabaseAuthProvider>{children}</SupabaseAuthProvider>;
  }
  return <CustomAuthProvider>{children}</CustomAuthProvider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
