import type { FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PasswordInput from './PasswordInput'
import { PASSWORD_HELPER_TEXT, useSignupForm } from '../hooks/useSignupForm'

export default function SignupForm() {
  const navigate = useNavigate()
  const { fields, errors, touched, isValid, isSubmitting, submitError, setField, setTouchedField, submit } =
    useSignupForm()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const response = await submit()
    if (response) {
      navigate('/login', {
        state: { successMessage: 'Account created — please log in' },
      })
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex w-full max-w-md flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="fullName" className="text-sm font-medium text-gray-700">
          Full Name
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          autoComplete="name"
          value={fields.fullName}
          onChange={(event) => setField('fullName', event.target.value)}
          onBlur={() => setTouchedField('fullName')}
          aria-invalid={touched.fullName && errors.fullName ? true : undefined}
          aria-describedby={touched.fullName && errors.fullName ? 'fullName-error' : undefined}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {touched.fullName && errors.fullName && (
          <p id="fullName-error" role="alert" className="text-xs text-red-600">
            {errors.fullName}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-gray-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          value={fields.email}
          onChange={(event) => setField('email', event.target.value)}
          onBlur={() => setTouchedField('email')}
          aria-invalid={touched.email && errors.email ? true : undefined}
          aria-describedby={touched.email && errors.email ? 'email-error' : undefined}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        {touched.email && errors.email && (
          <p id="email-error" role="alert" className="text-xs text-red-600">
            {errors.email}
          </p>
        )}
      </div>

      <PasswordInput
        id="password"
        label="Password"
        value={fields.password}
        onChange={(value) => setField('password', value)}
        onBlur={() => setTouchedField('password')}
        error={touched.password ? errors.password : undefined}
        helperText={PASSWORD_HELPER_TEXT}
        autoComplete="new-password"
      />

      <PasswordInput
        id="confirmPassword"
        label="Confirm Password"
        value={fields.confirmPassword}
        onChange={(value) => setField('confirmPassword', value)}
        onBlur={() => setTouchedField('confirmPassword')}
        error={touched.confirmPassword ? errors.confirmPassword : undefined}
        autoComplete="new-password"
      />

      {submitError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {submitError}
        </p>
      )}

      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="w-full rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500"
      >
        {isSubmitting ? 'Signing up…' : 'Sign Up'}
      </button>

      <p className="text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-indigo-600 hover:text-indigo-800">
          Login
        </Link>
      </p>
    </form>
  )
}
