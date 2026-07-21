import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResetPasswordScreen } from './ResetPasswordScreen';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderResetPasswordScreen() {
  return render(
    <MemoryRouter>
      <ResetPasswordScreen />
    </MemoryRouter>,
  );
}

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders New Password and Confirm Password fields with proper labels', () => {
    renderResetPasswordScreen();

    expect(screen.getByLabelText('New Password')).toBeInTheDocument();
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument();
  });

  it('masks both password fields by default and each has an independent show/hide toggle', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    const newPasswordInput = screen.getByLabelText('New Password') as HTMLInputElement;
    const confirmPasswordInput = screen.getByLabelText('Confirm Password') as HTMLInputElement;
    expect(newPasswordInput.type).toBe('password');
    expect(confirmPasswordInput.type).toBe('password');

    const toggleButtons = screen.getAllByRole('button', { name: 'Show password' });
    expect(toggleButtons).toHaveLength(2);

    await user.click(toggleButtons[0]);
    expect(newPasswordInput.type).toBe('text');
    expect(confirmPasswordInput.type).toBe('password');
  });

  it('displays the password rule as helper text', () => {
    renderResetPasswordScreen();

    expect(screen.getByText('Password must be at least 8 characters long.')).toBeInTheDocument();
  });

  it('keeps the submit button disabled until both fields are valid and matching', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('New Password'), 'Short1');
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('Confirm Password'), 'Short1');
    expect(submitButton).toBeDisabled();

    await user.clear(screen.getByLabelText('New Password'));
    await user.type(screen.getByLabelText('New Password'), 'ValidPass1');
    await user.clear(screen.getByLabelText('Confirm Password'));
    await user.type(screen.getByLabelText('Confirm Password'), 'ValidPass1');

    expect(submitButton).toBeEnabled();
  });

  it('shows an inline error when the password is too short', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    await user.type(screen.getByLabelText('New Password'), 'Sh0rt!');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters long.',
    );
  });

  it('shows an inline error when the passwords do not match', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    await user.type(screen.getByLabelText('New Password'), 'ValidPass1');
    await user.type(screen.getByLabelText('Confirm Password'), 'ValidPass2');

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.');
  });

  it('shows a loading state on submit, then transitions to the success state', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    await user.type(screen.getByLabelText('New Password'), 'ValidPass1');
    await user.type(screen.getByLabelText('Confirm Password'), 'ValidPass1');

    const submitButton = screen.getByRole('button', { name: 'Reset Password' });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /Resetting/ })).toBeDisabled();

    expect(await screen.findByText(/Password reset successful/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to Login' })).toBeInTheDocument();
  });

  it('moves focus to the success heading after a successful reset', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    await user.type(screen.getByLabelText('New Password'), 'ValidPass1');
    await user.type(screen.getByLabelText('Confirm Password'), 'ValidPass1');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    const heading = await screen.findByRole('heading', { name: /Password reset successful/ });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('navigates to /login when "Go to Login" is clicked after success', async () => {
    const user = userEvent.setup();
    renderResetPasswordScreen();

    await user.type(screen.getByLabelText('New Password'), 'ValidPass1');
    await user.type(screen.getByLabelText('Confirm Password'), 'ValidPass1');
    await user.click(screen.getByRole('button', { name: 'Reset Password' }));

    await screen.findByRole('button', { name: 'Go to Login' });
    await user.click(screen.getByRole('button', { name: 'Go to Login' }));

    expect(navigateMock).toHaveBeenCalledWith('/login');
  });
});