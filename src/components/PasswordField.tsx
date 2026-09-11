'use client'

import { useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

interface Props {
  value: string
  onChange: (value: string) => void
  label: string
  autoComplete?: string
  minLength?: number
  required?: boolean
}

export function PasswordField({ value, onChange, label, autoComplete, minLength, required = true }: Props) {
  const [shown, setShown] = useState(false)
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-mute">{label}</span>
      <span className="relative mt-2 block">
        <input
          type={shown ? 'text' : 'password'}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="field pr-12"
        />
        <button
          type="button"
          onClick={() => setShown(s => !s)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          className="absolute right-0 top-0 grid h-12 w-12 place-items-center text-mute transition-colors hover:text-live"
        >
          {shown ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
    </label>
  )
}
