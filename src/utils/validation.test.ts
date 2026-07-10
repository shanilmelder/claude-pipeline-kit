import { describe, expect, it } from 'vitest';
import { isValidEmail, trimValue } from './validation';

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
