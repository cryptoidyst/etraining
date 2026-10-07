'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from './api';
import { useAuthStore } from './auth-store';
import type { AuthUser, LoginResponse } from './types';

interface AuthContextValue {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<AuthUser>;
  register: (input: {
    username: string;
    fullName: string;
    email?: string;
    password: string;
  }) => Promise<string>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hydrated = useAuthStore((s) => s.hydrated);
  const setAuth = useAuthStore((s) => s.setAuth);
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const [verifying, setVerifying] = useState(false);

  const refresh = useCallback(
    async (activeToken: string) => {
      setVerifying(true);
      try {
        const me = await api<AuthUser>('/auth/me', { token: activeToken });
        setAuth(activeToken, me);
      } catch (error) {
        // Only drop the session when the token is actually rejected (401).
        // A 403 (missing permission) or a transient/network error must not log the user out.
        if (error instanceof ApiError && error.status === 401) {
          clearAuth();
        }
      } finally {
        setVerifying(false);
      }
    },
    [setAuth, clearAuth],
  );

  useEffect(() => {
    if (token) {
      void refresh(token);
    }
  }, [token, refresh]);

  const login = async (username: string, password: string) => {
    const response = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { username, password },
    });
    setAuth(response.accessToken, response.user);
    return response.user;
  };

  const register = async (input: {
    username: string;
    fullName: string;
    email?: string;
    password: string;
  }) => {
    const response = await api<{ message: string }>('/auth/register', {
      method: 'POST',
      body: input,
    });
    return response.message;
  };

  const logout = () => {
    clearAuth();
    router.push('/login');
  };

  const value = useMemo(
    () => ({
      token,
      user,
      isAuthenticated: Boolean(token && user),
      // Stay in a loading state until the persisted store has hydrated and, when a
      // token exists, until /auth/me has resolved. This prevents a redirect to
      // /login during the brief window where the store is still rehydrating.
      isLoading: !hydrated || (Boolean(token) && (verifying || !user)),
      login,
      register,
      logout,
    }),
    [token, user, hydrated, verifying, login, register, logout, router],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
