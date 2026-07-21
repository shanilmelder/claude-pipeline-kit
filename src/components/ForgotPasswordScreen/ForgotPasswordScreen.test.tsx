import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ForgotPasswordScreen } from './ForgotPasswordScreen';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderForgotPasswordScreen() {
  return render(
    <MemoryRouter>
      <ForgotPasswordScreen />
    </MemoryRouter>,
  );
}

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders an Email field with a proper label', () => {
    renderForgotPasswordScreen();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('keeps the submit button disabled until a valid email is entered', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    expect(submitButton).toBeDisabled();

    await user.clear(screen.getByLabelText('Email'));
    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    expect(submitButton).toBeEnabled();
  });

  it('shows a loading state on submit, then transitions to the confirmation screen', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    const submitButton = screen.getByRole('button', { name: 'Send Reset Link' });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /Sending/ })).toBeDisabled();

    expect(
      await screen.findByText(
        'If an account exists for this email, a reset link has been sent.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the same confirmation message regardless of whether the email exists', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    await user.type(screen.getByLabelText('Email'), 'definitely-does-not-exist@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(
      await screen.findByText(
        'If an account exists for this email, a reset link has been sent.',
      ),
    ).toBeInTheDocument();
  });

  it('moves focus to the confirmation heading after submitting', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    const heading = await screen.findByRole('heading', { name: 'Check your email' });
    await waitFor(() => expect(heading).toHaveFocus());
  });

  it('navigates back to /login when "Back to Login" is clicked on the request screen', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    await user.click(screen.getByRole('button', { name: 'Back to Login' }));

    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('navigates back to /login when "Back to Login" is clicked on the confirmation screen', async () => {
    const user = userEvent.setup();
    renderForgotPasswordScreen();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await screen.findByRole('heading', { name: 'Check your email' });
    await user.click(screen.getByRole('button', { name: 'Back to Login' }));

    expect(navigateMock).toHaveBeenCalledWith('/login');
  });

  it('disables "Resend email" during the cooldown and enables it once the cooldown elapses', async () => {
    vi.useFakeTimers();

    try {
      renderForgotPasswordScreen();

      fireEvent.change(screen.getByLabelText('Email'), {
        target: { value: 'user@example.com' },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Send Reset Link' }));

      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });

      expect(screen.getByRole('heading', { name: 'Check your email' })).toBeInTheDocument();

      const resendButton = screen.getByRole('button', { name: /Resend email/ });
      expect(resendButton).toBeDisabled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(30000);
      });

      expect(screen.getByRole('button', { name: 'Resend email' })).toBeEnabled();
    } finally {
      vi.useRealTimers();
    }
  });
});