import { describe, expect, it } from 'vitest';
import { authenticate } from './authService';
import { HARDCODED_EMAIL, HARDCODED_PASSWORD } from '../constants/auth';

describe('authenticate', () => {
  it('resolves true for the correct email and password', async () => {
    await expect(authenticate(HARDCODED_EMAIL, HARDCODED_PASSWORD)).resolves.toBe(true);
  });

  it('is case-insensitive and trims whitespace on the email', async () => {
    const paddedMixedCaseEmail = `  ${HARDCODED_EMAIL.toUpperCase()}  `;
    await expect(authenticate(paddedMixedCaseEmail, HARDCODED_PASSWORD)).resolves.toBe(true);
  });

  it('trims whitespace on the password but is otherwise case-sensitive', async () => {
    const paddedPassword = `  ${HARDCODED_PASSWORD}  `;
    await expect(authenticate(HARDCODED_EMAIL, paddedPassword)).resolves.toBe(true);
    await expect(authenticate(HARDCODED_EMAIL, HARDCODED_PASSWORD.toLowerCase())).resolves.toBe(
      false,
    );
  });

  it('resolves false for a wrong email', async () => {
    await expect(authenticate('someoneelse@example.com', HARDCODED_PASSWORD)).resolves.toBe(
      false,
    );
  });

  it('resolves false for a wrong password', async () => {
    await expect(authenticate(HARDCODED_EMAIL, 'WrongPass123')).resolves.toBe(false);
  });

  it('resolves false when both email and password are wrong', async () => {
    await expect(authenticate('nope@example.com', 'nope')).resolves.toBe(false);
  });
});
