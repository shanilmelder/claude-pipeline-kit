import { MIN_PASSWORD_LENGTH } from '../constants/auth';

/**
 * Basic email format check: requires a local part, an "@", and a domain
 * with at least one "." (e.g. "user@example.com"). Not a full RFC 5322
 * validator by design — the ticket only asks for basic format validation.
 */
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function trimValue(value: string): string {
  return value.trim();
}

export function isValidEmail(email: string): boolean {
  const trimmed = trimValue(email);
  if (trimmed.length === 0) {
    return false;
  }
  return EMAIL_REGEX.test(trimmed);
}

/**
 * KAN-4: minimum password "strength" rule — exactly what the ticket's own
 * acceptance criteria specifies (min 8 characters), nothing more.
 */
export function isValidPassword(password: string): boolean {
  return password.length >= MIN_PASSWORD_LENGTH;
}

/**
 * KAN-4: passwords match check for the reset password screen's inline
 * validation.
 */
export function passwordsMatch(password: string, confirmPassword: string): boolean {
  return password.length > 0 && password === confirmPassword;
}