import { useCallback, useMemo, useState } from 'react'
import { signup, SignupApiError, type SignupResponse } from '../api/signup'

export interface SignupFields {
  fullName: string
  email: string
  password: string
  confirmPassword: string
}

export interface SignupFieldErrors {
  fullName?: string
  email?: string
  password?: string
  confirmPassword?: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PASSWORD_MIN_LENGTH = 8

export function validateFullName(fullName: string): string | undefined {
  if (fullName.trim().length === 0) return 'Full name is required.'
  return undefined
}

export function validateEmail(email: string): string | undefined {
  if (email.trim().length === 0) return 'Email is required.'
  if (!EMAIL_PATTERN.test(email.trim())) return 'Enter a valid email address.'
  return undefined
}

export function validatePassword(password: string): string | undefined {
  if (password.length === 0) return 'Password is required.'
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`
  }
  if (!/\d/.test(password)) return 'Password must contain at least 1 number.'
  return undefined
}

export function validateConfirmPassword(
  confirmPassword: string,
  password: string,
): string | undefined {
  if (confirmPassword.length === 0) return 'Please confirm your password.'
  if (confirmPassword !== password) return 'Passwords do not match.'
  return undefined
}

// Helper text shown under the Password field regardless of error state, per
// AC #3 ("shown as helper text").
export const PASSWORD_HELPER_TEXT =
  'Must be at least 8 characters and include at least 1 number.'

const initialFields: SignupFields = {
  fullName: '',
  email: '',
  password: '',
  confirmPassword: '',
}

export function useSignupForm() {
  const [fields, setFields] = useState<SignupFields>(initialFields)
  const [touched, setTouched] = useState<Record<keyof SignupFields, boolean>>({
    fullName: false,
    email: false,
    password: false,
    confirmPassword: false,
  })
  const [submitError, setSubmitError] = useState<string | undefined>(undefined)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [result, setResult] = useState<SignupResponse | undefined>(undefined)

  const errors: SignupFieldErrors = useMemo(
    () => ({
      fullName: validateFullName(fields.fullName),
      email: validateEmail(fields.email),
      password: validatePassword(fields.password),
      confirmPassword: validateConfirmPassword(fields.confirmPassword, fields.password),
    }),
    [fields],
  )

  const isValid = useMemo(
    () => Object.values(errors).every((error) => error === undefined),
    [errors],
  )

  const setField = useCallback((name: keyof SignupFields, value: string) => {
    setFields((prev) => ({ ...prev, [name]: value }))
    // Any edit after a failed submit should clear the stale server-side error.
    setSubmitError(undefined)
  }, [])

  const setTouchedField = useCallback((name: keyof SignupFields) => {
    setTouched((prev) => ({ ...prev, [name]: true }))
  }, [])

  const submit = useCallback(async () => {
    setTouched({ fullName: true, email: true, password: true, confirmPassword: true })
    if (!isValid || isSubmitting) return

    setIsSubmitting(true)
    setSubmitError(undefined)
    try {
      const response = await signup(fields)
      setResult(response)
      return response
    } catch (error) {
      if (error instanceof SignupApiError) {
        setSubmitError(error.message)
      } else {
        setSubmitError('Something went wrong. Please try again.')
      }
      return undefined
    } finally {
      setIsSubmitting(false)
    }
  }, [fields, isValid, isSubmitting])

  return {
    fields,
    errors,
    touched,
    isValid,
    isSubmitting,
    submitError,
    result,
    setField,
    setTouchedField,
    submit,
  }
}
