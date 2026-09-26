'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { playDeskAlert, unlockAudio } from '@/lib/sounds'
import { asName, plural, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import { StatusMark } from '@/components/StatusMark'
import { BirthdayCard, type Celebrant } from '@/components/BirthdayCard'
import { WalkInWelcome } from './WalkInWelcome'
import { LiveClock } from './LiveClock'
import type { CheckInResult, CheckInKind } from '@/lib/types'

const COPY: Record<CheckInKind, { title: string; note: (r: CheckInResult) => string; tone: string }> = {
  valid: {
    title: 'Access granted',
    note: r => r.days_left + ' ' + plural(r.days_left ?? 0, 'day') + ' left',
    tone: 'text-live',
  },
  expired: {
    title: 'Membership expired',
    note: r => 'Ran out ' + shortDate(r.expires_at),
    tone: 'text-out',
  },
  no_membership: {
    title: 'No active subscription',
    note: () => 'Choose a plan to start training',
    tone: 'text-due',
  },
  duplicate: {
    title: 'Already checked in',
    note: r =>
      r.is_active ? 'Scanned earlier today · ' + r.days_left + ' ' + plural(r.days_left ?? 0, 'day') + ' left' : 'Scanned earlier today',
    tone: 'text-chalk',
  },
}

export default function CheckInScreen() {
  const params = useSearchParams()
  const { session, loading } = useAuth()
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [celebrants, setCelebrants] = useState<Celebrant[]>([])
  const [dismissed, setDismissed] = useState(false)
  const fired = useRef(false)

  const branch = params.get('b')

  const checkIn = useCallback(async () => {
    unlockAudio()
    setError(null)
    const { data, error: rpcError } = await supabase.rpc('check_in', { p_branch: branch })
    if (rpcError) {
      setError(rpcError.message.startsWith('Too many scans') ? rpcError.message : 'Check your connection and try again.')
      return
    }
    const payload = data as CheckInResult
    setResult(payload)
    playDeskAlert(payload.kind)

    if (payload.kind === 'valid' || payload.kind === 'duplicate') {
      void supabase
        .rpc('birthdays_today', { p_branch: branch })
        .then(({ data: today }) => setCelebrants((today ?? []) as Celebrant[]))
    }
    if (navigator.vibrate) navigator.vibrate(payload.kind === 'expired' ? [90, 60, 90, 60, 90] : 45)
  }, [branch])

  useEffect(() => {
    if (loading || fired.current) return
    // No session: a walk-in, or a member whose login lapsed. Both are answered
    // in render rather than bounced to a password box.
    if (!session) return
    fired.current = true
    void checkIn()
  }, [loading, session, checkIn])

  if (loading) return <Loader full label="Reading your membership" />

  if (!session) return <WalkInWelcome branch={branch} />

  if (!result && !error) return <Loader full label="Reading your membership" />

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center bg-base px-6 text-center">
        <div>
          <h1 className="text-4xl">Could not check you in</h1>
          <p className="mt-3 text-mute">{error}</p>
          <button onClick={() => void checkIn()} className="btn-primary mt-8">Try again</button>
        </div>
      </main>
    )
  }

  const outcome = result!
  const copy = COPY[outcome.kind]
  const who = asName(outcome.username) ?? outcome.full_name ?? 'Member'
  const welcomed = outcome.kind === 'valid' || outcome.kind === 'duplicate'

  return (
    <main className="relative grid min-h-dvh grid-rows-[1fr_auto] overflow-hidden bg-base">
      {/* a single wash of the state colour, low enough to stay a lighting effect */}
      <span
        aria-hidden
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-[60vh] opacity-[0.09] blur-[80px]',
          outcome.kind === 'valid' && 'bg-live',
          outcome.kind === 'expired' && 'bg-out',
          outcome.kind === 'no_membership' && 'bg-due',
          outcome.kind === 'duplicate' && 'bg-chalk'
        )}
      />

      <section className="relative flex flex-col items-center justify-center px-7 text-center">
        <StatusMark kind={outcome.kind} />

        <h1 className="animate-lift-1 mt-9 text-[2.75rem] leading-[0.95] sm:text-6xl">{copy.title}</h1>

        <p className={cn('animate-lift-2 mt-4 text-lg font-semibold', copy.tone)}>{copy.note(outcome)}</p>

        <p className="animate-lift-3 mt-8 text-[13px] font-semibold uppercase tracking-[0.28em] text-mute">
          {who}
        </p>

        {/* a running clock shows the desk this is live, not a saved screenshot */}
        <LiveClock className="animate-lift-3 mt-3 font-display text-2xl tabular-nums text-chalk-dim" />
      </section>

      {!dismissed && celebrants.length > 0 && (
        <BirthdayCard people={celebrants} onClose={() => setDismissed(true)} />
      )}

      <footer className="animate-lift-3 relative px-6 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {welcomed ? (
          <Link href="/m" className="btn-quiet w-full">Open my membership</Link>
        ) : (
          <Link href="/m/renew" className="btn-primary w-full">
            {outcome.kind === 'expired' ? 'Renew now' : 'Choose a plan'}
          </Link>
        )}
      </footer>
    </main>
  )
}
