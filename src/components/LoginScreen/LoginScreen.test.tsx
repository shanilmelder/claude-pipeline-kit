import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginScreen } from './LoginScreen';
import { HARDCODED_EMAIL, HARDCODED_PASSWORD } from '../../constants/auth';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function renderLoginScreen() {
  return render(
    <MemoryRouter>
      <LoginScreen />
    </MemoryRouter>,
  );
}

describe('LoginScreen', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  it('renders Email and Password fields with proper labels', () => {
    renderLoginScreen();

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
  });

  it('masks the password by default and reveals it via the show/hide toggle', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    const passwordInput = screen.getByLabelText('Password') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    await user.click(toggleButton);

    expect(passwordInput.type).toBe('text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hide password' }));
    expect(passwordInput.type).toBe('password');
  });

  it('keeps submit disabled until both fields are filled', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    const submitButton = screen.getByRole('button', { name: 'Login' });
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('Email'), 'user@example.com');
    expect(submitButton).toBeDisabled();

    await user.type(screen.getByLabelText('Password'), 'somepassword');
    expect(submitButton).toBeEnabled();
  });

  it('navigates to /dashboard on correct credentials', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), HARDCODED_EMAIL);
    await user.type(screen.getByLabelText('Password'), HARDCODED_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows an inline alert on wrong credentials and does not navigate', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpassword');
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('shows an inline alert for an invalid email format instead of navigating', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), HARDCODED_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Please enter a valid email address',
    );
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('submits the form when Enter is pressed', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), HARDCODED_EMAIL);
    await user.type(screen.getByLabelText('Password'), `${HARDCODED_PASSWORD}{Enter}`);

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('trims leading/trailing whitespace from the email before submitting', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), `   ${HARDCODED_EMAIL}   `);
    await user.type(screen.getByLabelText('Password'), HARDCODED_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Login' }));

    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/dashboard'));
  });

  it('disables the submit button and shows a loading indicator while submitting', async () => {
    const user = userEvent.setup();
    renderLoginScreen();

    await user.type(screen.getByLabelText('Email'), HARDCODED_EMAIL);
    await user.type(screen.getByLabelText('Password'), HARDCODED_PASSWORD);

    const submitButton = screen.getByRole('button', { name: 'Login' });
    await user.click(submitButton);

    expect(screen.getByRole('button', { name: /Logging in/ })).toBeDisabled();

    await waitFor(() => expect(navigateMock).toHaveBeenCalled());
  });

  it('renders a "Forgot Password?" link pointing to /forgot-password', () => {
    renderLoginScreen();

    const forgotPasswordLink = screen.getByRole('link', { name: 'Forgot Password?' });
    expect(forgotPasswordLink).toBeInTheDocument();
    expect(forgotPasswordLink).toHaveAttribute('href', '/forgot-password');
  });

  it('has a sensible tab order: email, password, toggle, submit', () => {
    renderLoginScreen();

    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Password');
    const toggleButton = screen.getByRole('button', { name: 'Show password' });
    const submitButton = screen.getByRole('button', { name: 'Login' });

    const focusableElements = [emailInput, passwordInput, toggleButton, submitButton];
    const bodyPositions = focusableElements.map((el) =>
      Array.from(document.body.querySelectorAll('input, button')).indexOf(el),
    );

    for (let i = 1; i < bodyPositions.length; i += 1) {
      expect(bodyPositions[i]).toBeGreaterThan(bodyPositions[i - 1]);
    }
  });
});