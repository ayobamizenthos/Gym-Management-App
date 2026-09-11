'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanLine, ArrowRight } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Settings } from '@/lib/types'

export default function MemberHome() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [qualified, setQualified] = useState(0)

  useEffect(() => {
    void supabase.from('settings').select('*').maybeSingle().then(({ data }) => setSettings(data as Settings))
  }, [])

  useEffect(() => {
    if (!profile) return
    void supabase
      .from('referrals')
      .select('id', { count: 'exact', head: true })
      .eq('referrer_id', profile.id)
      .not('qualified_at', 'is', null)
      .is('rewarded_at', null)
      .then(({ count }) => setQualified(count ?? 0))
  }, [profile])

  const left = daysLeft(profile?.expires_at ?? null)
  const active = left !== null && left > 0
  const expiringSoon = active && settings ? left <= settings.expiry_notice_days : false
  const target = settings?.referral_target ?? 3

  return (
    <div className="animate-rise">
      <p className="text-xs uppercase tracking-[0.28em] text-ink-mute">
        {profile?.full_name ?? 'Member'} · {profile?.member_code}
      </p>

      {/* The number is the interface. */}
      <section className="mt-6">
        {profile?.expires_at ? (
          <>
            <p className={cn('font-display text-[7rem] leading-[0.82] tabular-nums',
              !active ? 'text-alert' : expiringSoon ? 'text-warn' : 'text-volt')}>
              {left}
            </p>
            <p className="mt-1 text-2xl font-display uppercase tracking-tightest">
              {active ? `day${left === 1 ? '' : 's'} left` : 'days left'}
            </p>
            <p className="mt-3 text-sm text-ink-mute">
              {active ? `Runs to ${shortDate(profile.expires_at)}` : `Expired ${shortDate(profile.expires_at)}`}
            </p>
          </>
        ) : (
          <>
            <p className="font-display text-[5rem] leading-none text-warn">No plan</p>
            <p className="mt-3 text-sm text-ink-mute">Choose a plan to start training.</p>
          </>
        )}
      </section>

      {(!active || expiringSoon) && (
        <Link href="/m/renew"
          className={cn('mt-7 flex items-center justify-between border-l-2 px-4 py-4',
            !active ? 'border-alert bg-alert/10' : 'border-warn bg-warn/10')}>
          <span className="text-sm">
            {!active ? 'Your membership has run out.' : `Only ${left} day${left === 1 ? '' : 's'} left.`}
            {' '}<span className="font-semibold">Renew now</span>
          </span>
          <ArrowRight size={18} />
        </Link>
      )}

      <Link href="/m/scan" className="btn-volt mt-7 w-full">
        <ScanLine size={19} /> Scan to check in
      </Link>

      <div className="rule mt-9" />

      <section className="mt-6">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Invite &amp; earn</h2>
          <Link href="/m/referrals" className="text-sm text-volt underline-offset-4 hover:underline">Open</Link>
        </div>
        <p className="mt-2 text-sm text-ink-mute">
          {target} friends on a monthly plan or longer earns you{' '}
          {settings?.referral_reward_days ?? 7} free days.
        </p>
        <div className="mt-4 flex gap-1.5">
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1', i < qualified ? 'bg-volt' : 'bg-ink-line')} />
          ))}
        </div>
        <p className="mt-2 text-xs uppercase tracking-[0.2em] text-ink-mute">
          {qualified} of {target} counted
        </p>
      </section>
    </div>
  )
}
