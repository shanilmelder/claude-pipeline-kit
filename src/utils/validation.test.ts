import { describe, expect, it } from 'vitest';
import { isValidEmail, isValidPassword, passwordsMatch, trimValue } from './validation';

describe('trimValue', () => {
  it('removes leading and trailing whitespace', () => {
    expect(trimValue('  hello@example.com  ')).toBe('hello@example.com');
  });

  it('leaves a string with no surrounding whitespace unchanged', () => {
    expect(trimValue('hello@example.com')).toBe('hello@example.com');
  });
});

describe('isValidEmail', () => {
  it('accepts a well-formed email address', () => {
    expect(isValidEmail('shanilmelder@gmail.com')).toBe(true);
  });

  it('accepts a well-formed email address with surrounding whitespace', () => {
    expect(isValidEmail('  shanilmelder@gmail.com  ')).toBe(true);
  });

  it('rejects an empty string', () => {
    expect(isValidEmail('')).toBe(false);
  });

  it('rejects a string with only whitespace', () => {
    expect(isValidEmail('   ')).toBe(false);
  });

  it('rejects an email missing the "@" symbol', () => {
    expect(isValidEmail('shanilmeldergmail.com')).toBe(false);
  });

  it('rejects an email missing a domain', () => {
    expect(isValidEmail('shanilmelder@')).toBe(false);
  });

  it('rejects an email missing a top-level domain', () => {
    expect(isValidEmail('shanilmelder@gmail')).toBe(false);
  });

  it('rejects an email containing spaces', () => {
    expect(isValidEmail('shanil melder@gmail.com')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts a password that is exactly 8 characters long', () => {
    expect(isValidPassword('Pass@123')).toBe(true);
  });

  it('accepts a password longer than 8 characters', () => {
    expect(isValidPassword('SuperSecurePassword1')).toBe(true);
  });

  it('rejects a password shorter than 8 characters', () => {
    expect(isValidPassword('Sh0rt!')).toBe(false);
  });

  it('rejects an empty password', () => {
    expect(isValidPassword('')).toBe(false);
  });
});

describe('passwordsMatch', () => {
  it('returns true when both values are identical and non-empty', () => {
    expect(passwordsMatch('Pass@123', 'Pass@123')).toBe(true);
  });

  it('returns false when the values differ', () => {
    expect(passwordsMatch('Pass@123', 'Pass@124')).toBe(false);
  });

  it('returns false when both values are empty', () => {
    expect(passwordsMatch('Pass@123', '')).toBe(false);
  });

  it('returns false when the confirmation is empty but the password is not', () => {
    expect(passwordsMatch('Pass@123', '')).toBe(false);
  });
});