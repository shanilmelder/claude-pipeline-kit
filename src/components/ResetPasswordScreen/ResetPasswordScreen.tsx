import { FormEvent, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PasswordInput } from '../PasswordInput/PasswordInput';
import { resetPassword } from '../../services/passwordResetService';
import { isValidPassword, passwordsMatch } from '../../utils/validation';
import { MIN_PASSWORD_LENGTH } from '../../constants/auth';
import styles from './ResetPasswordScreen.module.css';

const PASSWORD_RULE_MESSAGE = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match.';

export function ResetPasswordScreen() {
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [touched, setTouched] = useState(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);

  const meetsStrengthRule = isValidPassword(newPassword);
  const doPasswordsMatch = passwordsMatch(newPassword, confirmPassword);
  const isFormValid = meetsStrengthRule && doPasswordsMatch;
  const isSubmitDisabled = !isFormValid || isSubmitting;

  const showStrengthError = touched && newPassword.length > 0 && !meetsStrengthRule;
  const showMismatchError = touched && confirmPassword.length > 0 && !doPasswordsMatch;

  useEffect(() => {
    if (isSuccess) {
      successHeadingRef.current?.focus();
    }
  }, [isSuccess]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTouched(true);

    if (!isFormValid || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(newPassword);
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoToLogin = () => {
    navigate('/login');
  };

  if (isSuccess) {
    return (
      <div className={styles.container}>
        <div className={styles.form}>
          <h1 className={styles.heading} ref={successHeadingRef} tabIndex={-1}>
            Password reset successful
          </h1>
          <p className={styles.successMessage}>
            Your password has been reset. You can now log in with your new password.
          </p>
          <button type="button" onClick={handleGoToLogin} className={styles.submitButton}>
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <h1 className={styles.heading}>Reset Password</h1>

        <div className={styles.field}>
          <PasswordInput
            id="new-password"
            label="New Password"
            value={newPassword}
            onChange={(value) => {
              setTouched(true);
              setNewPassword(value);
            }}
            autoComplete="new-password"
            required
          />
          <p id="password-rule" className={styles.helperText}>
            {PASSWORD_RULE_MESSAGE}
          </p>
          {showStrengthError && (
            <p role="alert" className={styles.error}>
              {PASSWORD_RULE_MESSAGE}
            </p>
          )}
        </div>

        <div className={styles.field}>
          <PasswordInput
            id="confirm-password"
            label="Confirm Password"
            value={confirmPassword}
            onChange={(value) => {
              setTouched(true);
              setConfirmPassword(value);
            }}
            autoComplete="new-password"
            required
          />
          {showMismatchError && (
            <p role="alert" className={styles.error}>
              {PASSWORD_MISMATCH_MESSAGE}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={styles.submitButton}
          aria-busy={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <span className={styles.spinner} aria-hidden="true" />
              Resetting&hellip;
            </>
          ) : (
            'Reset Password'
          )}
        </button>
      </form>
    </div>
  );
}