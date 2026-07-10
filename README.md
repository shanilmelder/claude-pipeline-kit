# Claude Pipeline Kit

A Vite + React + TypeScript front end. This ticket (KAN-1) bootstraps the
project from scratch and implements a basic login screen with hardcoded
demo credentials.

## Stack

- [Vite](https://vitejs.dev/) + React + TypeScript
- [React Router](https://reactrouter.com/) for routing (`/login`, `/dashboard`)
- [Vitest](https://vitest.dev/) + [React Testing Library](https://testing-library.com/react) for unit tests
- CSS Modules for component styling and responsiveness

## Getting started

```bash
npm install
npm run dev       # start the dev server
npm run build      # type-check and build for production
npm run test        # run the unit test suite once
npm run test:watch  # run the unit test suite in watch mode
```

## Login screen (KAN-1)

- Route: `/login` (also the default route at `/`)
- Hardcoded demo credentials (see `src/constants/auth.ts`):
  - Email: `shanilmelder@gmail.com`
  - Password: `Pass@123`
- On successful login, the user is redirected to `/dashboard` (placeholder page).
- On failure, an inline error message is shown.

This is intentionally a demo implementation with no real authentication
backend, per the ticket description.
