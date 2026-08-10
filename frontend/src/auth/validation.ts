/**
 * Client-side mirror of the server's validation rules, so the common mistakes
 * are caught inline without a round trip. The server remains authoritative —
 * anything it rejects is still surfaced via `ApiError.fieldErrors`.
 *
 * Rules (shared contract): email required, valid address, max 256 chars;
 * password required, 8–128 chars, no complexity rule.
 */

export const EMAIL_MAX_LENGTH = 256;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

// Deliberately permissive: catch obvious typos, let the server be the judge.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type AuthFieldErrors = Partial<Record<'email' | 'password', string>>;

export function validateEmail(rawEmail: string): string | undefined {
  const email = rawEmail.trim();
  if (email === '') return 'Email is required.';
  if (email.length > EMAIL_MAX_LENGTH) {
    return `Email must be ${EMAIL_MAX_LENGTH} characters or fewer.`;
  }
  if (!EMAIL_PATTERN.test(email)) return 'Enter a valid email address.';
  return undefined;
}

/**
 * @param enforceLength - true when creating a password (register). On login we
 *   only check presence, so an old short password still gets a real 401 rather
 *   than a misleading "too short" message.
 */
export function validatePassword(password: string, enforceLength: boolean): string | undefined {
  if (password === '') return 'Password is required.';
  if (!enforceLength) return undefined;
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > PASSWORD_MAX_LENGTH) {
    return `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`;
  }
  return undefined;
}

export function validateCredentials(
  email: string,
  password: string,
  enforcePasswordLength: boolean,
): AuthFieldErrors {
  const errors: AuthFieldErrors = {};
  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  const passwordError = validatePassword(password, enforcePasswordLength);
  if (passwordError) errors.password = passwordError;
  return errors;
}

/**
 * Map a server `ValidationProblemDetails.errors` object (keys already
 * lower-cased by the API client) onto our two form fields.
 */
export function mapServerFieldErrors(fieldErrors: Record<string, string[]>): AuthFieldErrors {
  const mapped: AuthFieldErrors = {};
  for (const [key, messages] of Object.entries(fieldErrors)) {
    const message = messages[0];
    if (!message) continue;
    if (key === 'email') mapped.email = message;
    else if (key === 'password') mapped.password = message;
  }
  return mapped;
}
