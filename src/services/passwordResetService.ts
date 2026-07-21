/**
 * KAN-4 (Forgot Password Flow — UI Only).
 *
 * These are MOCKED, no-op services — there is no real backend integration,
 * no email is actually sent, and no password is actually reset. Each
 * function simulates network latency with setTimeout so the UI's loading
 * states are real and testable, following the same Promise + setTimeout
 * pattern as `authService.ts`. Wiring these up to a real API is explicitly
 * out of scope for this ticket and left for a follow-up story.
 */

/** Small artificial delay so the loading state (AC5) is real/testable. */
const REQUEST_RESET_DELAY_MS = 300;

/** Small artificial delay so the loading state (AC15) is real/testable. */
const RESET_PASSWORD_DELAY_MS = 300;

/**
 * Simulates requesting a password reset email for the given address.
 *
 * Per AC9 (no account enumeration), this always "succeeds" from the
 * caller's point of view regardless of whether the email exists — there is
 * no real backend to check against anyway.
 */
export function requestPasswordReset(_email: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, REQUEST_RESET_DELAY_MS);
  });
}

/**
 * Simulates resetting the password to the given new value. This is UI-only
 * (AC17): no token validation happens here, the incoming link is assumed
 * valid, and no real reset occurs.
 */
export function resetPassword(_newPassword: string): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, RESET_PASSWORD_DELAY_MS);
  });
}