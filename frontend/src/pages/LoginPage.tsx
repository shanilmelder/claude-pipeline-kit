import { useLocation } from 'react-router-dom'

// Placeholder login page. KAN-6 only requires a real navigation target for
// the post-signup redirect and the "Already have an account? Login" link —
// actual login/auth is out of scope for this ticket and there is no
// login/auth work elsewhere in the repo yet (greenfield). A future ticket
// should replace this with the real login form + API integration.
export default function LoginPage() {
  const location = useLocation()
  const successMessage = (location.state as { successMessage?: string } | null)?.successMessage

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md text-center">
        {successMessage && (
          <p
            role="status"
            className="mb-6 rounded-md bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
          >
            {successMessage}
          </p>
        )}
        <h1 className="text-2xl font-bold text-gray-900">Login</h1>
        <p className="mt-2 text-sm text-gray-600">Login functionality not yet implemented.</p>
      </div>
    </main>
  )
}
