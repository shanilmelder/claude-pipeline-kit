import { useNavigate } from 'react-router-dom';
import { getSession, logout } from '../../services/sessionService';
import styles from './DashboardHeader.module.css';

/**
 * Sticky dashboard header (KAN-3, AC1-5): shows the logged-in user's email
 * and a Logout control that clears the demo session and redirects to
 * /login. Collapses to an icon-only logout button on narrow viewports via
 * DashboardHeader.module.css, keeping the username visible.
 */
export function DashboardHeader() {
  const navigate = useNavigate();
  const session = getSession();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className={styles.header}>
      <span className={styles.userInfo}>{session?.email ?? ''}</span>
      <button
        type="button"
        className={styles.logoutButton}
        onClick={handleLogout}
        aria-label="Logout"
      >
        <span className={styles.logoutIcon} aria-hidden="true">
          &#x21B0;
        </span>
        <span className={styles.logoutLabel} aria-hidden="true">
          Logout
        </span>
      </button>
    </header>
  );
}
