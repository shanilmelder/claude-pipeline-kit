import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { ApiError } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  PASSWORD_MIN_LENGTH,
  mapServerFieldErrors,
  validateCredentials,
  type AuthFieldErrors,
} from '../auth/validation';
import AuthCard from '../components/AuthCard';
import ErrorBanner from '../components/ErrorBanner';
import FormField from '../components/FormField';

const GENERIC_FAILURE = 'We could not create your account. Please try again.';

export default function Register() {
  const { register } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<AuthFieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setFormError(null);

    // Full length rules apply here — this is where the password is created.
    const clientErrors = validateCredentials(email, password, true);
    setFieldErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;

    setSubmitting(true);
    try {
      await register({ email: email.trim(), password });
      // Registration returns a token, so auth state flips straight to
      // authenticated and PublicOnlyRoute lands the user on /dashboard.
    } catch (error) {
      if (error instanceof ApiError) {
        const mapped = mapServerFieldErrors(error.fieldErrors);
        setFieldErrors(mapped);
        // 409 "email already registered" has no `errors` object, so it shows
        // as a banner using the server's `detail`/`title`.
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
      title="Create your account"
      subtitle="Start tracking your income and spending."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/login"
            className="font-medium text-emerald-700 underline-offset-2 hover:underline"
          >
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <ErrorBanner message={formError} />

        <FormField
          id="register-email"
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
          id="register-password"
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
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
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthCard>
  );
}
