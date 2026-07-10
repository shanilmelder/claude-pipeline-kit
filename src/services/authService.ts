import { HARDCODED_EMAIL, HARDCODED_PASSWORD } from '../constants/auth';
import { trimValue } from '../utils/validation';

/** Small artificial delay so the loading state (AC11) is real/testable. */
const AUTH_DELAY_MS = 300;

/**
 * Authenticates the given credentials against the hardcoded demo account.
 * Email comparison is case-insensitive and trimmed; password comparison is
 * case-sensitive and trimmed (leading/trailing whitespace only).
 */
export function authenticate(email: string, password: string): Promise<boolean> {
  return new Promise((resolve) => {
    setTimeout(() => {
      const normalizedEmail = trimValue(email).toLowerCase();
      const normalizedPassword = trimValue(password);

      const emailMatches = normalizedEmail === HARDCODED_EMAIL.toLowerCase();
      const passwordMatches = normalizedPassword === HARDCODED_PASSWORD;

      resolve(emailMatches && passwordMatches);
    }, AUTH_DELAY_MS);
  });
}
