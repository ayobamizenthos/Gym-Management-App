'use client'

import { fullPhone, localPhone } from '@/lib/format'

interface Props {
  label: string
  /** Stored form, +2348031245567. */
  value: string
  onChange: (value: string) => void
  required?: boolean
}

/** A Nigerian number with +234 fixed in front, so nobody types the country code or the leading 0. */
export function PhoneField({ label, value, onChange, required }: Props) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="field mt-1.5 flex items-center gap-2 focus-within:bg-base-raised">
        <span className="text-[16px] font-semibold text-chalk">+234</span>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          required={required}
          value={localPhone(value)}
          onChange={event => onChange(fullPhone(event.target.value.replace(/\D/g, '').slice(0, 11)))}
          className="h-full min-w-0 flex-1 bg-transparent text-[16px] text-chalk outline-none"
        />
      </span>
    </label>
  )
}
