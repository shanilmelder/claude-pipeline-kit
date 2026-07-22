import SignupForm from '../components/SignupForm'

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">Create your account</h1>
        <SignupForm />
      </div>
    </main>
  )
}
