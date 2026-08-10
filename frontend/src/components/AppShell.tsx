import { useState, type ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useAuth } from '../auth/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions' },
  { to: '/budgets', label: 'Budgets' },
] as const;

const NAV_BASE =
  'rounded-md px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500';
const NAV_ACTIVE = 'bg-emerald-50 text-emerald-700';
const NAV_INACTIVE = 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';

/**
 * Chrome for every authenticated screen: app name, primary nav, the signed-in
 * user's email and a logout control.
 *
 * `NavLink` handles the active state for us — it applies `aria-current="page"`
 * to the matching link automatically, and we layer Tailwind classes on top via
 * the `isActive` render prop so the current route is visually distinct too.
 */
export default function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      // Clears the token and flips auth state, which bounces us to /login.
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-6 px-4 sm:px-6">
          <span className="text-lg font-semibold tracking-tight text-slate-900">
            Ledger
          </span>

          <nav aria-label="Main" className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `${NAV_BASE} ${isActive ? NAV_ACTIVE : NAV_INACTIVE}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            {/*
              Render nothing rather than `undefined` if the email has not
              resolved yet — the shell only mounts once authenticated, so this
              is belt-and-braces.
            */}
            <span
              className="hidden max-w-[16rem] truncate text-sm text-slate-600 sm:inline"
              title={user?.email ?? ''}
            >
              {user?.email ?? ''}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? 'Logging out…' : 'Log out'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
