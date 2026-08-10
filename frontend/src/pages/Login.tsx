import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  mapServerFieldErrors,
  validateCredentials,
  type AuthFieldErrors,
} from '../auth/validation';
import AuthCard from '../components/AuthCard';
import ErrorBanner from '../components/ErrorBanner';
import FormField from '../components/FormField';

const GENERIC_FAILURE = 'We could not sign you in. Please try again.';

export default function Login() {
  const { login } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);

    // Only presence is enforced here; length rules would mislead on an
    // existing account whose password predates the current policy.
    const clientErrors = validateCredentials(email, password, false);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      // On success the auth state flips and PublicOnlyRoute redirects to
      // /dashboard, so there is nothing to navigate to by hand.
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped = mapServerFieldErrors(error.fieldErrors);
        setFieldErrors(mapped);
        // A 401 (and any error we couldn't attach to a field) becomes a banner.
        setFormError(Object.keys(mapped).length > 0 ? null : error.message);
      } else {
        setFieldErrors({});
        setFormError(GENERIC_FAILURE);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Enter your details to continue."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link
            to="/register"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <ErrorBanner message={formError} />

        <FormField
          id="login-email"
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          disabled={submitting}
          error={fieldErrors.email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <FormField
          id="login-password"
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          disabled={submitting}
          error={fieldErrors.password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <button
          type="submit"
          disabled={submitting}
          aria-busy={submitting}
          className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthCard>
  );
}
