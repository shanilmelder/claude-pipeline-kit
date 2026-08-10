import { useAuth } from '../auth/AuthContext';
import PagePlaceholder from '../components/PagePlaceholder';

/** Minimal landing screen for this story; the real widgets arrive in KAN-11/12. */
export default function Dashboard() {
  const { user } = useAuth();

  return (
    <PagePlaceholder
      title="Dashboard"
      // `user` is always resolved by the time the shell renders, but fall back
      // to neutral copy rather than risking "Signed in as undefined".
      description={
        user?.email
          ? `Signed in as ${user.email}. Your spending summary will appear here.`
          : 'Your spending summary will appear here.'
      }
    />
  );
}
