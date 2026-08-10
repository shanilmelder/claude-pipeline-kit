/**
 * The single HTTP entry point for the whole app.
 *
 * Every call to the Ledger API goes through `apiFetch`, which:
 *  - resolves the base URL from `VITE_API_BASE_URL`,
 *  - attaches `Authorization: Bearer <jwt>` for protected calls,
 *  - normalises RFC 7807 ProblemDetails responses into an `ApiError`,
 *  - guarantees a human-readable message (never `undefined`/`null`).
 *
 * Later stories (transactions, budgets, dashboard) add calls here rather than
 * introducing a second HTTP client.
 */

const DEFAULT_BASE_URL = 'http://localhost:5080/api';

function resolveBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  const value =
    typeof configured === 'string' && configured.trim() !== ''
      ? configured.trim()
      : DEFAULT_BASE_URL;
  // Strip trailing slashes so `${base}/auth/login` never doubles up.
  return value.replace(/\/+$/, '');
}

export const API_BASE_URL = resolveBaseUrl();

export const TOKEN_STORAGE_KEY = 'ledger.token';

/* -------------------------------------------------------------------------- */
/* Token storage                                                              */
/* -------------------------------------------------------------------------- */

// localStorage can throw (Safari private mode, disabled storage), so every
// access is defensive. A missing store simply means "not logged in".

export function readToken(): string | null {
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return token && token.trim() !== '' ? token : null;
  } catch {
    return null;
  }
}

export function writeToken(token: string): void {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    /* Storage unavailable — the session simply won't survive a reload. */
  }
}

export function clearToken(): void {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* Nothing to do — treated as already cleared. */
  }
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

/** Field name (lower-cased) -> list of messages for that field. */
export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Populated from a `ValidationProblemDetails.errors` object, keys lower-cased. */
  readonly fieldErrors: FieldErrors;

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.fieldErrors = fieldErrors;
  }

  /** True when the server returned per-field validation messages. */
  get hasFieldErrors(): boolean {
    return Object.keys(this.fieldErrors).length > 0;
  }
}

const NETWORK_ERROR_MESSAGE =
  'Unable to reach the server. Check your connection and try again.';

/**
 * Fallback copy for responses with no usable body — notably the 401 produced by
 * the JWT middleware, which has an empty body. We must never surface
 * `undefined` to the user.
 */
function fallbackMessageForStatus(status: number): string {
  switch (status) {
    case 400:
      return 'Please check the details you entered and try again.';
    case 401:
      return 'Your session has expired. Please sign in again.';
    case 403:
      return 'You do not have permission to do that.';
    case 404:
      return 'We could not find what you were looking for.';
    case 409:
      return 'That conflicts with something that already exists.';
    default:
      return status >= 500
        ? 'Something went wrong on our side. Please try again shortly.'
        : 'Something went wrong. Please try again.';
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Normalise `ValidationProblemDetails.errors` into lower-cased keys so callers
 * can match `Email` and `email` alike.
 */
function parseFieldErrors(body: unknown): FieldErrors {
  if (!isRecord(body) || !isRecord(body.errors)) return {};

  const result: FieldErrors = {};
  for (const [rawKey, rawValue] of Object.entries(body.errors)) {
    const key = rawKey.trim().toLowerCase();
    if (key === '') continue;

    const messages = (Array.isArray(rawValue) ? rawValue : [rawValue])
      .map(nonEmptyString)
      .filter((message): message is string => message !== null);

    if (messages.length > 0) {
      result[key] = [...(result[key] ?? []), ...messages];
    }
  }
  return result;
}

/** `detail` wins over `title`; a hardcoded fallback wins over nothing. */
function parseErrorMessage(body: unknown, status: number): string {
  if (isRecord(body)) {
    const detail = nonEmptyString(body.detail);
    if (detail) return detail;
    const title = nonEmptyString(body.title);
    if (title) return title;
  }
  return fallbackMessageForStatus(status);
}

/* -------------------------------------------------------------------------- */
/* Unauthorized handling                                                      */
/* -------------------------------------------------------------------------- */

type UnauthorizedHandler = () => void;

let unauthorizedHandler: UnauthorizedHandler | null = null;

/**
 * Registered by `AuthProvider`. Invoked when an *authenticated* request comes
 * back 401, which means the stored token is invalid or expired.
 *
 * Anonymous calls (login/register) are excluded on purpose: a 401 there is a
 * wrong password, not an expired session.
 */
export function setUnauthorizedHandler(handler: UnauthorizedHandler | null): void {
  unauthorizedHandler = handler;
}

/* -------------------------------------------------------------------------- */
/* Request                                                                    */
/* -------------------------------------------------------------------------- */

export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Serialised as JSON when present. */
  body?: unknown;
  /** Attach the bearer token. Defaults to true; set false for login/register. */
  auth?: boolean;
  signal?: AbortSignal;
}

async function readBody(response: Response): Promise<unknown> {
  // 204 and empty bodies are normal (e.g. logout, JWT-middleware 401s).
  if (response.status === 204) return null;
  const text = await response.text().catch(() => '');
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  if (auth) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const url = `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    // Re-throw aborts untouched so callers can ignore them.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError(0, NETWORK_ERROR_MESSAGE);
  }

  const parsed = await readBody(response);

  if (!response.ok) {
    if (response.status === 401 && auth) {
      // Token is invalid/expired: drop it and let the app bounce to /login.
      unauthorizedHandler?.();
    }
    throw new ApiError(
      response.status,
      parseErrorMessage(parsed, response.status),
      parseFieldErrors(parsed),
    );
  }

  return parsed as T;
}

/* -------------------------------------------------------------------------- */
/* Typed endpoints                                                            */
/* -------------------------------------------------------------------------- */

export interface User {
  id: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

/** Guards against a malformed 2xx body so we never store `undefined` as a token. */
function assertAuthResponse(value: unknown): AuthResponse {
  if (
    isRecord(value) &&
    nonEmptyString(value.token) &&
    isRecord(value.user) &&
    nonEmptyString((value.user as Record<string, unknown>).email)
  ) {
    return value as unknown as AuthResponse;
  }
  throw new ApiError(0, 'The server returned an unexpected response. Please try again.');
}

function assertUser(value: unknown): User {
  if (isRecord(value) && nonEmptyString(value.email)) {
    return value as unknown as User;
  }
  throw new ApiError(0, 'The server returned an unexpected response. Please try again.');
}

export interface Credentials {
  email: string;
  password: string;
}

export async function registerRequest(credentials: Credentials): Promise<AuthResponse> {
  return assertAuthResponse(
    await apiFetch<unknown>('/auth/register', {
      method: 'POST',
      body: credentials,
      auth: false,
    }),
  );
}

export async function loginRequest(credentials: Credentials): Promise<AuthResponse> {
  return assertAuthResponse(
    await apiFetch<unknown>('/auth/login', {
      method: 'POST',
      body: credentials,
      auth: false,
    }),
  );
}

export async function meRequest(signal?: AbortSignal): Promise<User> {
  return assertUser(await apiFetch<unknown>('/auth/me', { signal }));
}

export async function logoutRequest(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}

export interface Category {
  id: number;
  name: string;
  type: 'income' | 'expense';
}

/** Used from KAN-9 onwards; defined here so all HTTP stays in one module. */
export async function getCategories(signal?: AbortSignal): Promise<Category[]> {
  const result = await apiFetch<unknown>('/categories', { signal });
  return Array.isArray(result) ? (result as Category[]) : [];
}
