import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { UserList } from './UserList';
import { User } from '../../services/usersService';

const fetchUsersMock = vi.fn();

vi.mock('../../services/usersService', async () => {
  const actual =
    await vi.importActual<typeof import('../../services/usersService')>(
      '../../services/usersService',
    );
  return {
    ...actual,
    fetchUsers: () => fetchUsersMock(),
  };
});

function buildUsers(count: number): User[] {
  return Array.from({ length: count }, (_, index) => ({
    id: String(index + 1),
    name: `User ${String(index + 1).padStart(2, '0')}`,
    email: `user${index + 1}@example.com`,
    role: index % 2 === 0 ? 'Admin' : 'Member',
  }));
}

describe('UserList', () => {
  beforeEach(() => {
    fetchUsersMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a loading state while users are being fetched', () => {
    fetchUsersMock.mockReturnValue(new Promise(() => {}));

    render(<UserList />);

    expect(screen.getByText(/Loading users/)).toBeInTheDocument();
    expect(screen.getByText(/Loading users/).closest('[aria-busy="true"]')).toBeTruthy();
  });

  it('renders users in a table once loaded', async () => {
    fetchUsersMock.mockResolvedValue(buildUsers(3));

    render(<UserList />);

    expect(await screen.findByText('User 01')).toBeInTheDocument();
    expect(screen.getByText('user1@example.com')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Name/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Email/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /Role/ })).toBeInTheDocument();
  });

  it('shows an empty state when there are no users', async () => {
    fetchUsersMock.mockResolvedValue([]);

    render(<UserList />);

    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  it('shows an error state when the fetch fails', async () => {
    fetchUsersMock.mockRejectedValue(new Error('network error'));

    render(<UserList />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to load users, please try again',
    );
  });

  it('filters users by name or email', async () => {
    const user = userEvent.setup();
    fetchUsersMock.mockResolvedValue(buildUsers(3));

    render(<UserList />);

    await screen.findByText('User 01');

    await user.type(screen.getByLabelText('Search users'), 'user2@example.com');

    expect(screen.queryByText('User 01')).not.toBeInTheDocument();
    expect(screen.getByText('User 02')).toBeInTheDocument();
  });

  it('shows the "no users found" message when a filter matches nothing', async () => {
    const user = userEvent.setup();
    fetchUsersMock.mockResolvedValue(buildUsers(3));

    render(<UserList />);

    await screen.findByText('User 01');
    await user.type(screen.getByLabelText('Search users'), 'nobody-matches-this');

    expect(await screen.findByText('No users found')).toBeInTheDocument();
  });

  it('sorts by a column when its header is clicked, toggling direction', async () => {
    const user = userEvent.setup();
    fetchUsersMock.mockResolvedValue(buildUsers(3));

    render(<UserList />);
    await screen.findByText('User 01');

    const nameHeaderButton = screen.getByRole('button', { name: /Name/ });

    await user.click(nameHeaderButton);
    let rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('User 03')).toBeInTheDocument();

    await user.click(nameHeaderButton);
    rows = screen.getAllByRole('row').slice(1);
    expect(within(rows[0]).getByText('User 01')).toBeInTheDocument();
  });

  it('paginates results at a fixed page size', async () => {
    const user = userEvent.setup();
    fetchUsersMock.mockResolvedValue(buildUsers(12));

    render(<UserList />);
    await screen.findByText('User 01');

    expect(screen.getAllByRole('row')).toHaveLength(11); // header + 10 users
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.queryByText('User 11')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('User 11')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });
});
