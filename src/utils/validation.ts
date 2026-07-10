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
