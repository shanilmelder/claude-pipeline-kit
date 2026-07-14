import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '../PasswordInput/PasswordInput';
import { authenticate } from '../../services/authService';
import { login } from '../../services/sessionService';
import { isValidEmail, trimValue } from '../../utils/validation';
import styles from './LoginScreen.module.css';

const INVALID_CREDENTIALS_MESSAGE = 'Invalid email or password';
const INVALID_EMAIL_FORMAT_MESSAGE = 'Please enter a valid email address';

export function LoginScreen() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const bothFieldsFilled = email.trim().length > 0 && password.length > 0;
  const isSubmitDisabled = !bothFieldsFilled || isSubmitting;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitDisabled) {
      return;
    }

    setError(null);

    const trimmedEmail = trimValue(email);

    if (!isValidEmail(trimmedEmail)) {
      setError(INVALID_EMAIL_FORMAT_MESSAGE);
      return;
    }

    setIsSubmitting(true);
    try {
      const isAuthenticated = await authenticate(trimmedEmail, password);
      if (isAuthenticated) {
        login(trimmedEmail);
        navigate('/dashboard');
      } else {
        setError(INVALID_CREDENTIALS_MESSAGE);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Log in</h1>

        <div className={styles.field}>
          <label htmlFor="email" className={styles.label}>
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            aria-required="true"
            className={styles.input}
          />
        </div>

        <PasswordInput
          id="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          required
        />

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
              Logging in&hellip;
            </>
          ) : (
            'Login'
          )}
        </button>
      </form>
    </div>
  );
}
