'use client';

import { Eye, EyeOff } from 'lucide-react';
import { useState } from 'react';

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
};

// Password input with a show/hide toggle. autoComplete="new-password" +
// the 1Password/LastPass ignore hints are the strongest cross-browser lever
// available to stop a saved value from silently appearing in the field.
export function PasswordField({ id, value, onChange, placeholder, required, minLength, autoFocus }: Props) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="password-field">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        autoComplete="new-password"
        data-1p-ignore
        data-lpignore="true"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
      <button type="button" className="password-toggle" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'}>
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}
