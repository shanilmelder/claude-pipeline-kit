import { SESSION_STORAGE_KEY } from '../constants/auth';

export interface Session {
  email: string;
}

/**
 * Minimal demo session layer (KAN-3).
 *
 * No real backend/token issuance exists yet, so we store a simple session
 * marker in sessionStorage (cleared automatically when the tab closes) under
 * a single constant key. This is a stand-in sufficient to gate the
 * dashboard route and drive the header/logout flow until real
 * auth/session/token infrastructure exists.
 */
export function getSession(): Session | null {
  const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Session;
    if (typeof parsed?.email !== 'string' || parsed.email.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function login(email: string): void {
  const session: Session = { email };
  sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function logout(): void {
  sessionStorage.removeItem(SESSION_STORAGE_KEY);
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}
