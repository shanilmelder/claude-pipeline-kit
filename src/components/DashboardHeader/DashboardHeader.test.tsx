import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardHeader } from './DashboardHeader';
import { getSession, login, logout } from '../../services/sessionService';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderHeader() {
  return render(
    <MemoryRouter>
      <DashboardHeader />
    </MemoryRouter>,
  );
}

describe('DashboardHeader', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    logout();
  });

  it("renders the logged-in user's email", () => {
    login('someone@example.com');

    renderHeader();

    expect(screen.getByText('someone@example.com')).toBeInTheDocument();
  });

  it('renders a Logout button', () => {
    login('someone@example.com');

    renderHeader();

    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument();
  });

  it('clears the session and navigates to /login when Logout is clicked', async () => {
    const user = userEvent.setup();
    login('someone@example.com');

    renderHeader();

    await user.click(screen.getByRole('button', { name: 'Logout' }));

    expect(getSession()).toBeNull();
    expect(navigateMock).toHaveBeenCalledWith('/login', { replace: true });
  });
});
