import { Navigate, Outlet } from 'react-router-dom';
import { isAuthenticated } from '../../services/sessionService';

/**
 * Route guard (KAN-3, AC15): renders the nested route via <Outlet/> when a
 * demo session exists, otherwise redirects to /login. Used by wrapping
 * protected <Route> elements in App.tsx.
 */
export function ProtectedRoute() {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
