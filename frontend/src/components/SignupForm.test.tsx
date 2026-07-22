import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignupForm from './SignupForm'
import LoginPage from '../pages/LoginPage'

function renderSignupForm() {
  return render(
    <MemoryRouter initialEntries={['/signup']}>
      <Routes>
        <Route path="/signup" element={<SignupForm />} />
        <Route path="/login" element={<LoginPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

const VALID_FULL_NAME = 'Jane Doe'
const VALID_EMAIL = 'jane@example.com'
const VALID_PASSWORD = 'password1'

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText('Full Name'), VALID_FULL_NAME)
  await user.type(screen.getByLabelText('Email'), VALID_EMAIL)
  await user.type(screen.getByLabelText('Password'), VALID_PASSWORD)
  await user.type(screen.getByLabelText('Confirm Password'), VALID_PASSWORD)
}

describe('SignupForm', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('renders all required fields with accessible labels', () => {
    renderSignupForm()

    expect(screen.getByLabelText('Full Name')).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByLabelText('Confirm Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign up/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
  })

  it('masks password fields by default and toggles visibility', async () => {
    const user = userEvent.setup()
    renderSignupForm()

    const password = screen.getByLabelText('Password') as HTMLInputElement
    expect(password).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: /show password/i }))
    expect(password).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: /hide password/i }))
    expect(password).toHaveAttribute('type', 'password')
  })

  it('disables the Sign Up button until all fields are valid', async () => {
    const user = userEvent.setup()
    renderSignupForm()

    const submitButton = screen.getByRole('button', { name: /sign up/i })
    expect(submitButton).toBeDisabled()

    await fillValidForm(user)

    expect(submitButton).toBeEnabled()
  })

  it('shows inline validation errors for each field on blur', async () => {
    const user = userEvent.setup()
    renderSignupForm()

    await user.click(screen.getByLabelText('Full Name'))
    await user.tab()
    expect(await screen.findByText(/full name is required/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Email'), 'not-an-email')
    await user.tab()
    expect(await screen.findByText(/valid email address/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Password'), 'short')
    await user.tab()
    expect(await screen.findByText(/password must be at least 8 characters/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Password'), '12345678')
    await user.tab()
    expect(await screen.findByText(/at least 1 number/i)).toBeInTheDocument()

    await user.type(screen.getByLabelText('Confirm Password'), 'different1')
    await user.tab()
    expect(await screen.findByText(/passwords do not match/i)).toBeInTheDocument()
  })

  it('always shows password helper text', () => {
    renderSignupForm()
    expect(
      screen.getByText(/must be at least 8 characters and include at least 1 number/i),
    ).toBeInTheDocument()
  })

  it('shows a loading state and disables the button while the request is in flight', async () => {
    const user = userEvent.setup()
    let resolveFetch: (value: Response) => void = () => {}
    vi.mocked(fetch).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve
        }),
    )

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(screen.getByRole('button', { name: /signing up/i })).toBeDisabled()

    resolveFetch(
      new Response(
        JSON.stringify({
          id: '1',
          fullName: VALID_FULL_NAME,
          email: VALID_EMAIL,
          createdAt: new Date().toISOString(),
        }),
        { status: 201 },
      ),
    )

    await waitFor(() => expect(screen.getByRole('status')).toBeInTheDocument())
  })

  it('redirects to /login with a success message on successful signup', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          id: '1',
          fullName: VALID_FULL_NAME,
          email: VALID_EMAIL,
          createdAt: new Date().toISOString(),
        }),
        { status: 201 },
      ),
    )

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument()
    expect(screen.getByText(/account created — please log in/i)).toBeInTheDocument()
  })

  it('displays the backend error message on a 409 conflict (duplicate email)', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
        status: 409,
      }),
    )

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(
      await screen.findByText(/an account with this email already exists/i),
    ).toBeInTheDocument()
  })

  it('displays the backend error message on a 400 validation error', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Password must contain at least 1 number.' }), {
        status: 400,
      }),
    )

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/password must contain at least 1 number/i)).toBeInTheDocument()
  })

  it('displays a generic error message on a 500 server error', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ error: 'Something went wrong. Please try again.' }), {
        status: 500,
      }),
    )

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('displays a generic error message on a 429 rate-limit response', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 429 }))

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument()
  })

  it('displays a generic error message on a network failure', async () => {
    const user = userEvent.setup()
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'))

    renderSignupForm()
    await fillValidForm(user)
    await user.click(screen.getByRole('button', { name: /sign up/i }))

    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument()
  })

  it('supports full keyboard navigation through the form', async () => {
    const user = userEvent.setup()
    renderSignupForm()

    await user.tab()
    expect(screen.getByLabelText('Full Name')).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText('Email')).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText('Password')).toHaveFocus()

    await user.tab()
    expect(screen.getByRole('button', { name: /show password/i })).toHaveFocus()

    await user.tab()
    expect(screen.getByLabelText('Confirm Password')).toHaveFocus()
  })
})
