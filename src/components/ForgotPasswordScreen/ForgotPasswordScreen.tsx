import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { requestPasswordReset } from '../../services/passwordResetService';
import { isValidEmail, trimValue } from '../../utils/validation';
import { RESEND_COOLDOWN_SECONDS } from '../../constants/auth';
import styles from './ForgotPasswordScreen.module.css';

const INVALID_EMAIL_FORMAT_MESSAGE = 'Please enter a valid email address';
const CONFIRMATION_MESSAGE =
  'If an account exists for this email, a reset link has been sent.';

type Step = 'request' | 'confirmation';

export function ForgotPasswordScreen() {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('request');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(RESEND_COOLDOWN_SECONDS);
  const confirmationHeadingRef = useRef<HTMLHeadingElement>(null);

  const trimmedEmail = trimValue(email);
  const isEmailValid = isValidEmail(trimmedEmail);
  const isSubmitDisabled = !isEmailValid || isSubmitting;
  const isResendDisabled = isResending || cooldownSeconds > 0;

  useEffect(() => {
    if (step !== 'confirmation') {
      return;
    }
    // Move focus to the confirmation message so screen readers/keyboard
    // users land on the new state (AC accessibility: focus management).
    confirmationHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (step !== 'confirmation') {
      return;
    }
    // A single interval (rather than a chain of one-off timeouts) so the
    // countdown doesn't depend on effects re-running between each tick —
    // that keeps it simpler to reason about and to drive with fake timers
    // in tests.
    const intervalId = window.setInterval(() => {
      setCooldownSeconds((prev) => Math.max(prev - 1, 0));
    }, 1000);
    return () => window.clearInterval(intervalId);
  }, [step]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setError(null);

    if (!isEmailValid) {
      setError(INVALID_EMAIL_FORMAT_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
      setStep('confirmation');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (isResendDisabled) {
      return;
    }

    setIsResending(true);
    try {
      await requestPasswordReset(trimmedEmail);
      setCooldownSeconds(RESEND_COOLDOWN_SECONDS);
    } finally {
      setIsResending(false);
    }
  };

  const handleBackToLogin = () => {
    navigate('/login');
  };

  if (step === 'confirmation') {
    return (
      <div className={styles.container}>
        <div className={styles.form}>
          <h1 className={styles.heading} ref={confirmationHeadingRef} tabIndex={-1}>
            Check your email
          </h1>

          <p className={styles.confirmationMessage}>{CONFIRMATION_MESSAGE}</p>

          <button
            type="button"
            onClick={handleResend}
            disabled={isResendDisabled}
            className={styles.secondaryButton}
            aria-busy={isResending}
          >
            {isResending
              ? 'Resending…'
              : cooldownSeconds > 0
                ? `Resend email (${cooldownSeconds}s)`
                : 'Resend email'}
          </button>

          <button type="button" onClick={handleBackToLogin} className={styles.linkButton}>
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Forgot Password</h1>
        <p className={styles.subheading}>
          Enter your email address and we&rsquo;ll send you a link to reset your password.
        </p>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-required="true"
            className={styles.input}
          />
        </div>

        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={styles.submitButton}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Sending&hellip;
            </>
          ) : (
            'Send Reset Link'
          )}
        </button>

        <button type="button" onClick={handleBackToLogin} className={styles.linkButton}>
          Back to Login
        </button>
      </form>
    </div>
  );
}