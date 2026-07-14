import { describe, expect, it } from 'vitest';
import { fetchUsers } from './usersService';

describe('fetchUsers', () => {
  it('resolves with a non-empty array of users with the expected shape', async () => {
    const users = await fetchUsers();

    expect(users.length).toBeGreaterThan(0);
    users.forEach((user) => {
      expect(user).toEqual(
        expect.objectContaining({
          id: expect.any(String),
          name: expect.any(String),
          email: expect.any(String),
          role: expect.any(String),
        }),
      );
    });
  });
});
