// API client for POST /api/signup against Signup.Api (see backend/Signup.Api).
//
// Base URL: defaults to a relative path ("/api/signup"), which works when the
// frontend is served from the same origin as the API, or in local dev via the
// Vite dev-server proxy configured in vite.config.ts (routes /api/* to
// http://localhost:5231). Set VITE_API_BASE_URL (e.g. in a .env file) to point
// at a different origin, e.g. for a deployment where frontend and backend are
// on separate hosts and CORS has been configured on the backend for it.

export interface SignupRequest {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface SignupResponse {
  id: string
  fullName: string
  email: string
  createdAt: string
}

export class SignupApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'SignupApiError'
    this.status = status
  }
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

// Generic fallback message shown when the backend doesn't hand us a specific
// { error: string } body to display (e.g. network failure, or a 429 from the
// signup rate limiter, which the backend deliberately does not spec a body
// for — treated here as a generic failure per the frontend-agent's brief).
const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.'
const RATE_LIMIT_MESSAGE = 'Too many attempts. Please wait a moment and try again.'

export async function signup(request: SignupRequest): Promise<SignupResponse> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}/api/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    })
  } catch {
    throw new SignupApiError(GENERIC_ERROR_MESSAGE, 0)
  }

  if (response.status === 201) {
    return (await response.json()) as SignupResponse
  }

  if (response.status === 429) {
    throw new SignupApiError(RATE_LIMIT_MESSAGE, 429)
  }

  if (response.status === 400 || response.status === 409) {
    try {
      const body = (await response.json()) as { error?: string }
      throw new SignupApiError(body.error ?? GENERIC_ERROR_MESSAGE, response.status)
    } catch (err) {
      if (err instanceof SignupApiError) throw err
      throw new SignupApiError(GENERIC_ERROR_MESSAGE, response.status)
    }
  }

  throw new SignupApiError(GENERIC_ERROR_MESSAGE, response.status)
}
