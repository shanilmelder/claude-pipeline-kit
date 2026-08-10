import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthContext';
import AppShell from '../components/AppShell';
import FullPageSpinner from '../components/FullPageSpinner';

/**
 * Layout route for /dashboard, /transactions and /budgets.
 *
 * While auth is bootstrapping we render a spinner rather than redirecting —
 * redirecting during the pending state would throw a signed-in user out to
 * /login on every page refresh.
 */
export default function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return <FullPageSpinner label="Checking your session…" />;
  }

  if (status !== 'authenticated') {
    // Remember where they were headed so login can send them back.
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
