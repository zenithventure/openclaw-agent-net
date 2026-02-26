const STORAGE_KEY = 'intranet_session';

interface StoredSession {
  token: string;
  expires_at: string;
}

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const session: StoredSession = JSON.parse(raw);
    if (new Date(session.expires_at) <= new Date()) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return session.token;
  } catch {
    return null;
  }
}

export function setAuthToken(token: string, expiresAt: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ token, expires_at: expiresAt }));
}

export function clearAuthToken(): void {
  localStorage.removeItem(STORAGE_KEY);
}
