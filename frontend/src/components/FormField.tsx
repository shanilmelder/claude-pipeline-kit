import type { InputHTMLAttributes } from 'react';

interface FormFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Inline message rendered beside (below) this field. */
  error?: string;
  hint?: string;
}

/**
 * A labelled input that renders its validation message inline and wires up the
 * accessibility attributes (`aria-invalid`, `aria-describedby`) that screen
 * readers need to associate the message with the field.
 */
export default function FormField({
  id,
  label,
  error,
  hint,
  className = '',
  ...inputProps
}: FormFieldProps) {
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errorId : null, hint ? hintId : null]
    .filter(Boolean)
    .join(' ');

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        className={`rounded-md border px-3 py-2 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:bg-slate-50 ${
          error
            ? 'border-red-400 focus-visible:ring-red-500'
            : 'border-slate-300 focus-visible:ring-emerald-500'
        } ${className}`}
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
