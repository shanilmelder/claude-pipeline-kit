import { describe, expect, it } from 'vitest'
import {
  validateConfirmPassword,
  validateEmail,
  validateFullName,
  validatePassword,
} from './useSignupForm'

describe('validateFullName', () => {
  it('requires a non-empty name', () => {
    expect(validateFullName('')).toMatch(/required/i)
    expect(validateFullName('   ')).toMatch(/required/i)
    expect(validateFullName('Jane Doe')).toBeUndefined()
  })
})

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('')).toMatch(/required/i)
  })

  it('rejects invalid email formats', () => {
    expect(validateEmail('not-an-email')).toMatch(/valid email/i)
    expect(validateEmail('missing@domain')).toMatch(/valid email/i)
  })

  it('accepts a valid email', () => {
    expect(validateEmail('jane@example.com')).toBeUndefined()
  })
})

describe('validatePassword', () => {
  it('requires a value', () => {
    expect(validatePassword('')).toMatch(/required/i)
  })

  it('requires at least 8 characters', () => {
    expect(validatePassword('short1')).toMatch(/at least 8 characters/i)
  })

  it('requires at least one digit', () => {
    expect(validatePassword('nodigitshere')).toMatch(/at least 1 number/i)
  })

  it('accepts a valid password', () => {
    expect(validatePassword('password1')).toBeUndefined()
  })
})

describe('validateConfirmPassword', () => {
  it('requires a value', () => {
    expect(validateConfirmPassword('', 'password1')).toMatch(/confirm/i)
  })

  it('requires a match', () => {
    expect(validateConfirmPassword('password2', 'password1')).toMatch(/do not match/i)
  })

  it('accepts a match', () => {
    expect(validateConfirmPassword('password1', 'password1')).toBeUndefined()
  })
})
