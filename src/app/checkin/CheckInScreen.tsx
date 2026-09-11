'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2, AlertTriangle, RotateCcw, UserX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { playDeskAlert, unlockAudio } from '@/lib/sounds'
import { shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import type { CheckInResult, CheckInKind } from '@/lib/types'

const SKIN: Record<CheckInKind, {
  label: string
  note: (r: CheckInResult) => string
  bg: string
  fg: string
  Icon: typeof CheckCircle2
  motion: string
}> = {
  valid: {
    label: 'You are in',
    note: r => `${r.days_left} day${r.days_left === 1 ? '' : 's'} left on your membership`,
    bg: 'bg-live', fg: 'text-white', Icon: CheckCircle2, motion: 'animate-pop',
  },
  expired: {
    label: 'Membership expired',
    note: r => `Ran out ${shortDate(r.expires_at)}. Renew to train today.`,
    bg: 'bg-out', fg: 'text-white', Icon: AlertTriangle, motion: 'animate-shake',
  },
  duplicate: {
    label: 'Already checked in',
    note: r => (r.is_active ? `You scanned earlier today. ${r.days_left} days left.` : 'You scanned earlier today.'),
    bg: 'bg-base-panel', fg: 'text-chalk', Icon: RotateCcw, motion: 'animate-pop',
  },
  no_membership: {
    label: 'No active plan',
    note: () => 'Pick a plan to start training.',
    bg: 'bg-due', fg: 'text-white', Icon: UserX, motion: 'animate-pop',
  },
}

export default function CheckInScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const { session, loading } = useAuth()
  const [result, setResult] = useState<CheckInResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fired = useRef(false)

  const branch = params.get('b')

  const run = useCallback(async () => {
    unlockAudio()
    const { data, error: rpcError } = await supabase.rpc('check_in', { p_branch: branch })
    if (rpcError) {
      setError(rpcError.message)
      return
    }
    const payload = data as CheckInResult
    setResult(payload)
    playDeskAlert(payload.kind)
    if (navigator.vibrate) navigator.vibrate(payload.kind === 'expired' ? [90, 60, 90, 60, 90] : 45)
  }, [branch])

  useEffect(() => {
    if (loading || fired.current) return
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(`/checkin${branch ? `?b=${branch}` : ''}`)}`)
      return
    }
    fired.current = true
    void run()
  }, [loading, session, run, router, branch])

  if (loading || (!result && !error)) return <Loader full label="Checking your membership" />

  if (error) {
    return (
      <main className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <h1 className="text-4xl">Could not check you in</h1>
          <p className="mt-3 text-mute">{error}</p>
          <button onClick={() => void run()} className="btn-primary mt-8">Try again</button>
        </div>
      </main>
    )
  }

  const skin = SKIN[result!.kind]
  const { Icon } = skin

  return (
    <main className={cn('grid min-h-dvh grid-rows-[1fr_auto]', skin.bg, skin.fg)}>
      <section className="flex flex-col items-center justify-center px-6 text-center">
        <span className={cn('relative grid h-28 w-28 place-items-center', skin.motion)}>
          {result!.kind === 'valid' && (
            <span className="absolute inset-0 animate-ring rounded-full border-4 border-white/40" />
          )}
          <Icon size={104} strokeWidth={1.6} />
        </span>

        <h1 className="mt-8 text-6xl sm:text-7xl">{skin.label}</h1>
        <p className="mt-4 max-w-sm text-lg opacity-80">{skin.note(result!)}</p>

        <p className="mt-10 text-sm uppercase tracking-[0.25em] opacity-70">
          {result!.full_name ?? 'Member'}
        </p>
      </section>

      <footer className="p-6">
        {result!.kind === 'valid' || result!.kind === 'duplicate' ? (
          <Link href="/m" className="btn w-full rounded-md border border-current">Open my membership</Link>
        ) : (
          <Link href="/m/renew" className="btn w-full rounded-md bg-white text-ink">Renew now</Link>
        )}
      </footer>
    </main>
  )
}
