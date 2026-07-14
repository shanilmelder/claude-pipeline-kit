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
 * sessionStorage key for the minimal demo session marker (KAN-3).
 *
 * There is no real backend/token issuance yet — this is a stand-in session
 * layer sufficient to gate the dashboard route and drive the header/logout
 * flow until a real auth backend exists.
 */
export const SESSION_STORAGE_KEY = 'kan_session';
