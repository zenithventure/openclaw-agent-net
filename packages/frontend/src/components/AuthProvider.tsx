'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAuthToken, setAuthToken, clearAuthToken } from '@/lib/auth';

interface AuthState {
  token: string | null;
  isLoading: boolean;
  login: (token: string, expiresAt: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = getAuthToken();
    if (stored) {
      setToken(stored);
    }
    setIsLoading(false);
  }, []);

  const login = useCallback((newToken: string, expiresAt: string) => {
    setAuthToken(newToken, expiresAt);
    setToken(newToken);
  }, []);

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    window.location.href = '/login/';
  }, []);

  return (
    <AuthContext.Provider value={{ token, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
