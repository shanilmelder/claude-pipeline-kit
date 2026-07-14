import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardPage } from './DashboardPage';
import { login, logout } from '../services/sessionService';

vi.mock('../services/usersService', async () => {
  const actual =
    await vi.importActual<typeof import('../services/usersService')>('../services/usersService');
  return {
    ...actual,
    fetchUsers: () => Promise.resolve([]),
  };
});

describe('DashboardPage', () => {
  beforeEach(() => {
    logout();
    login('someone@example.com');
  });

  it('renders the header with user email and the user list heading', async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(screen.getByText('someone@example.com')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });
});
