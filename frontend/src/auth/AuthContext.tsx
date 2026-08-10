import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  ApiError,
  clearToken,
  loginRequest,
  logoutRequest,
  meRequest,
  readToken,
  registerRequest,
  setUnauthorizedHandler,
  writeToken,
  type Credentials,
  type User,
} from '../api/client';

/**
 * `loading` is the bootstrap window while `GET /api/auth/me` resolves the
 * stored token. Protected routes must render a loading state during it rather
 * than redirecting, otherwise refreshing the page bounces a signed-in user to
 * /login before we know who they are.
 */
export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  login: (credentials: Credentials) => Promise<void>;
  register: (credentials: Credentials) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [user, setUser] = useState<User | null>(null);

  // Lets the client's 401 hook reset state without re-registering on every render.
  const resetToAnonymous = useCallback(() => {
    clearToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const resetRef = useRef(resetToAnonymous);
  resetRef.current = resetToAnonymous;

  // Any 401 on an authenticated call means the token is dead — sign out.
  useEffect(() => {
    setUnauthorizedHandler(() => resetRef.current());
    return () => setUnauthorizedHandler(null);
  }, []);

  // Bootstrap: resolve the stored token into a user exactly once on mount.
  useEffect(() => {
    const token = readToken();
    if (!token) {
      setStatus('anonymous');
      return;
    }

    const controller = new AbortController();
    let active = true;

    meRequest(controller.signal)
      .then((resolved) => {
        if (!active) return;
        setUser(resolved);
        setStatus('authenticated');
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === 'AbortError') return;
        // A 401 already cleared the token via the unauthorized handler. For a
        // network blip we keep the token (the API may just be down) but still
        // fall back to anonymous, because we cannot vouch for the session.
        if (!(error instanceof ApiError) || error.status !== 401) {
          setUser(null);
          setStatus('anonymous');
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const login = useCallback(async (credentials: Credentials) => {
    const result = await loginRequest(credentials);
    writeToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const register = useCallback(async (credentials: Credentials) => {
    // Registration auto-logs-in and returns a token, so this mirrors login.
    const result = await registerRequest(credentials);
    writeToken(result.token);
    setUser(result.user);
    setStatus('authenticated');
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } catch {
      // Logout is stateless server-side; clear the token either way.
    }
    clearToken();
    setUser(null);
    setStatus('anonymous');
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, login, register, logout }),
    [status, user, login, register, logout],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth must be used within an <AuthProvider>.');
  }
  return context;
}
