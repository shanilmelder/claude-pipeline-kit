/**
 * Hardcoded demo credentials for KAN-1 (Basic Login Screen).
 *
 * NOTE: This is intentional, ticket-authored, non-production demo content —
 * NOT a leaked secret. The ticket explicitly calls for hardcoded credentials
 * for initial development. Do not replace with env-var indirection or add
 * secret-scanning suppressions; this is in scope as written.
 */
export const HARDCODED_EMAIL = 'shanilmelder@gmail.com';
export const HARDCODED_PASSWORD = 'Pass@123';

/**
 * KAN-4 (Forgot Password Flow — UI Only).
 *
 * Cooldown, in seconds, before the "Resend email" link/button on the
 * confirmation screen becomes clickable again. No design was attached to
 * the ticket for this value — 30s is the example the ticket itself gives,
 * used here as a reasonable default. Revisit if design/product provides a
 * different value.
 */
export const RESEND_COOLDOWN_SECONDS = 30;

/**
 * Minimum password length enforced by the (UI-only, mocked) reset password
 * screen. The ticket's own acceptance criteria only specifies "min 8
 * characters" as its example strength rule, so that's exactly what's
 * implemented here — no additional complexity rules (uppercase/number/
 * symbol requirements) were added since the ticket doesn't ask for them.
 */
export const MIN_PASSWORD_LENGTH = 8;