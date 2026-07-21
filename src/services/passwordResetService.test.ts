import { describe, expect, it } from 'vitest';
import { requestPasswordReset, resetPassword } from './passwordResetService';

describe('requestPasswordReset', () => {
  it('resolves for an existing-looking email', async () => {
    await expect(requestPasswordReset('shanilmelder@gmail.com')).resolves.toBeUndefined();
  });

  it('also resolves for an email that would not exist (no account enumeration)', async () => {
    await expect(requestPasswordReset('nobody@example.com')).resolves.toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('resolves for a new password', async () => {
    await expect(resetPassword('NewPass@123')).resolves.toBeUndefined();
  });
});