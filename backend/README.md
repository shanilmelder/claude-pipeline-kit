# Ledger API

.NET 10 minimal-API backend for the Ledger personal finance app.

## Running locally

1. Start PostgreSQL 18 (from the repo root):

   ```
   docker compose up -d postgres
   ```

   This exposes `localhost:5432` with database/user/password all `ledger`,
   matching the development connection string in
   `Ledger.Api/appsettings.Development.json`.

2. Apply the schema (creates the tables and seeds the 11 categories):

   ```
   cd backend/Ledger.Api
   dotnet ef database update
   ```

3. Run the API:

   ```
   cd backend/Ledger.Api
   dotnet run
   ```

   It listens on `http://localhost:5080` and allows CORS from the Vite dev
   server at `http://localhost:5173`.

## Configuration

| Setting | Development source | Production source |
|---|---|---|
| `ConnectionStrings:Ledger` | `appsettings.Development.json` | `ConnectionStrings__Ledger` env var |
| `Jwt:Key` | dev-only placeholder in `appsettings.Development.json` | `Jwt__Key` env var or user-secrets |

The dev signing key is a public placeholder, not a secret. The app refuses to
start if `Jwt:Key` is empty, so production must supply one.

## Endpoints

| Method | Route | Auth | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | anonymous | 201 with `{ token, user }`; 409 if the email exists |
| POST | `/api/auth/login` | anonymous | 200 with `{ token, user }`; 401 on bad credentials |
| GET | `/api/auth/me` | Bearer | 200 with `{ id, email }` |
| POST | `/api/auth/logout` | Bearer | 204; tokens are stateless, logout is a client-side discard |
| GET | `/api/categories` | Bearer | 200 with the fixed seeded list, ordered by type then id |

Authorization is on by default via a fallback policy — a new endpoint requires a
token unless it explicitly opts out with `AllowAnonymous`.

Categories are a fixed seeded set with stable ids 1–11 that later stories
foreign-key to. There is deliberately no endpoint to create, rename or delete
one.

## Tests

There are intentionally no automated tests in this repository. The source
requirement document's CONSTRAINTS section forbids building them, so their
absence is a deliberate decision, not an oversight.
