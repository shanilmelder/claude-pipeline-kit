import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import FullPageSpinner from '../components/FullPageSpinner';

/** Only allow `/` sub-paths that look like an in-app route, never an absolute URL. */
function safeRedirectTarget(value: unknown): string {
  return typeof value === 'string' && /^\/[^/\\]/.test(value) ? value : '/dashboard';
}

/**
 * Layout route for /login and /register. Once authenticated, these screens
 * redirect away — which is also what lands the user on /dashboard immediately
 * after a successful sign-in.
 */
export default function PublicOnlyRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageSpinner label="Checking your session…" />;
  }

  if (status === 'authenticated') {
    const state = location.state as { from?: unknown } | null;
    return <Navigate to={safeRedirectTarget(state?.from)} replace />;
  }

  return <Outlet />;
}
