import { useId, useState, type ChangeEvent } from 'react'

interface PasswordInputProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: () => void
  error?: string
  helperText?: string
  autoComplete?: string
}

export default function PasswordInput({
  id,
  label,
  value,
  onChange,
  onBlur,
  error,
  helperText,
  autoComplete,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)
  const helperId = useId()
  const errorId = useId()

  const describedBy = [helperText ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          name={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
          onBlur={onBlur}
          autoComplete={autoComplete}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className="w-full rounded-md border border-gray-300 px-3 py-2 pr-16 text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          type="button"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {helperText && (
        <p id={helperId} className="text-xs text-gray-500">
          {helperText}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
