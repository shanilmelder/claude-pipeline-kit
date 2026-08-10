# Ledger — web client

React 19 + Vite + TypeScript + Tailwind CSS v4 single-page app for the Ledger
personal finance tracker.

## Getting started

```bash
cp .env.example .env.local   # optional; the default already points at localhost:5080
npm ci
npm run dev                  # http://localhost:5173
```

The dev server port is pinned to `5173` because the API's CORS policy allows
exactly that origin.

## Scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server on port 5173 |
| `npm run build` | Type-checks (`tsc -b`) then produces a production build in `dist/` |
| `npm run preview` | Serves the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Vitest (currently no test files — see below) |

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `VITE_API_BASE_URL` | `http://localhost:5080/api` | Base URL of the Ledger API, including the `/api` prefix |

## Structure

```
src/
  api/client.ts        Single HTTP entry point: bearer token, ProblemDetails handling
  auth/                Auth context, route guards, shared validation rules
  components/          App shell and reusable UI pieces
  pages/               One component per route
```

All network access goes through `src/api/client.ts`. Add new endpoints there
rather than calling `fetch` from a component or introducing a second HTTP
client.

## Auth model

- The JWT is kept in `localStorage` under `ledger.token`.
- On load, `AuthProvider` resolves that token via `GET /api/auth/me`. Protected
  routes render a spinner while this is in flight — they deliberately do *not*
  redirect during the pending state, or a refresh would sign the user out.
- Any `401` on an authenticated request clears the token and returns the user
  to `/login`. A `401` from login/register is treated as bad credentials, not
  an expired session.
- Logout clears the token regardless of whether `POST /api/auth/logout`
  succeeds.

## Tests

There are no test files on this story: the source requirement document's
CONSTRAINTS section explicitly excludes automated tests. Vitest and React
Testing Library are installed as devDependencies so later stories can add tests
without re-tooling, and `npm test` passes (`--passWithNoTests`) in the meantime.
