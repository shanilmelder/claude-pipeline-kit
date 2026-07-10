import { ChangeEvent, useId, useState } from 'react';
import styles from './PasswordInput.module.css';

interface PasswordInputProps {
  id?: string;
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
}

export function PasswordInput({
  id,
  label = 'Password',
  value,
  onChange,
  autoComplete = 'current-password',
  required = false,
}: PasswordInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [visible, setVisible] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  const toggleVisibility = () => {
    setVisible((prev) => !prev);
  };

  return (
    <div className={styles.wrapper}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={styles.inputRow}>
        <input
          id={inputId}
          name="password"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={handleChange}
          autoComplete={autoComplete}
          required={required}
          aria-required={required}
          className={styles.input}
        />
        <button
          type="button"
          onClick={toggleVisibility}
          className={styles.toggleButton}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  );
}
