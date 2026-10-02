'use client'

import { useEffect, useState } from 'react'
import { Check, LoaderCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { USERNAME_PATTERN } from '@/lib/members'
import { cn } from '@/lib/cn'
import { useLatest } from '@/hooks/useLatest'

const CHECK_DELAY_MS = 400

type State = 'idle' | 'checking' | 'free' | 'taken' | 'invalid'

interface Props {
  value: string
  onChange: (value: string) => void
  onStateChange?: (ok: boolean) => void
  label?: string
  hint?: string
  required?: boolean
}

/**
 * The username is how a member is identified, so a clash has to surface while
 * they are still typing rather than after they have filled in a whole form and
 * pressed the button. The server checks again on submit - this is courtesy, not
 * the guard.
 */
export function UsernameField({
  value,
  onChange,
  onStateChange,
  label = 'Username',
  hint = '',
  required,
}: Props) {
  const [state, setState] = useState<State>('idle')
  const reportRef = useLatest(onStateChange)

  useEffect(() => {
    const report = (ok: boolean) => reportRef.current?.(ok)
    const name = value.trim().toLowerCase()
    if (!name) { setState('idle'); report(!required); return }
    if (!USERNAME_PATTERN.test(name)) { setState('invalid'); report(false); return }

    let current = true
    setState('checking')
    report(false)
    // wait for them to stop typing before asking
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc('username_available', { p_username: name })
      if (!current) return
      if (error) { setState('idle'); report(true); return }
      const free = data === true
      setState(free ? 'free' : 'taken')
      report(free)
    }, CHECK_DELAY_MS)

    return () => {
      current = false
      clearTimeout(timer)
    }
  }, [value, required, reportRef])

  return (
    <label className="block">
      <span className="label">{label}</span>
      <span className="relative mt-1.5 block">
        <input
          required={required}
          value={value}
          onChange={e => onChange(e.target.value.replace(/[^a-zA-Z0-9_]/g, '').toLowerCase())}
          maxLength={20}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          aria-invalid={state === 'taken' || state === 'invalid'}
          className="field pr-11"
        />
        <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2">
          {state === 'checking' && <LoaderCircle size={17} className="animate-spin text-mute" aria-hidden />}
          {state === 'free' && <Check size={17} className="text-live" aria-hidden />}
        </span>
      </span>
      <span
        role={state === 'taken' || state === 'invalid' ? 'alert' : undefined}
        hidden={state === 'idle' && !hint}
        className={cn(
          'mt-1.5 block text-sm',
          state === 'taken' || state === 'invalid' ? 'text-out' : 'text-mute'
        )}
      >
        {state === 'taken'
          ? 'Username already exists'
          : state === 'invalid'
            ? 'Use 3-20 letters, numbers or underscore'
            : state === 'free'
              ? 'Available'
              : hint}
      </span>
    </label>
  )
}
