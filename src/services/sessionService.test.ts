import { beforeEach, describe, expect, it } from 'vitest';
import { getSession, isAuthenticated, login, logout } from './sessionService';
import { SESSION_STORAGE_KEY } from '../constants/auth';

describe('sessionService', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('returns null when no session exists', () => {
    expect(getSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('stores a session marker under the constant key on login', () => {
    login('user@example.com');

    expect(sessionStorage.getItem(SESSION_STORAGE_KEY)).toBe(
      JSON.stringify({ email: 'user@example.com' }),
    );
    expect(getSession()).toEqual({ email: 'user@example.com' });
    expect(isAuthenticated()).toBe(true);
  });

  it('clears the session on logout', () => {
    login('user@example.com');
    logout();

    expect(getSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });

  it('treats malformed stored data as no session', () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'not-json');

    expect(getSession()).toBeNull();
    expect(isAuthenticated()).toBe(false);
  });
});
