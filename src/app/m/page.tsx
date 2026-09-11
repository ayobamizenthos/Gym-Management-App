'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanLine } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Settings } from '@/lib/types'

export default function MemberHome() {
  const { profile } = useAuth()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [counted, setCounted] = useState(0)

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
      .then(({ count }) => setCounted(count ?? 0))
  }, [profile])

  const left = daysLeft(profile?.expires_at ?? null)
  const active = left !== null && left > 0
  const notice = settings?.expiry_notice_days ?? 5
  const soon = active && left <= notice
  const target = settings?.referral_target ?? 3

  return (
    <div className="animate-rise">
      <p className="text-xs uppercase tracking-[0.28em] text-ink-mute">
        {profile?.full_name ?? 'Member'}
      </p>

      <section className="mt-8">
        {profile?.expires_at ? (
          <>
            <p
              className={cn(
                'font-display text-[7.5rem] leading-[0.8] tabular-nums',
                !active ? 'text-alert' : soon ? 'text-warn' : 'text-volt'
              )}
            >
              {left}
            </p>
            <h1 className="mt-2 text-3xl">{active ? 'days left' : 'days left'}</h1>
            <p className="mt-3 text-sm text-ink-mute">
              {active ? 'Runs to ' + shortDate(profile.expires_at) : 'Ended ' + shortDate(profile.expires_at)}
            </p>
          </>
        ) : (
          <>
            <h1 className="text-5xl text-warn">No plan</h1>
            <p className="mt-3 text-sm text-ink-mute">Choose a plan to start training.</p>
          </>
        )}
      </section>

      {/* One decisive action, weighted to the state the member is in. */}
      <div className="mt-9 flex flex-col gap-3">
        {active && !soon ? (
          <>
            <Link href="/m/scan" className="btn-volt w-full">
              <ScanLine size={19} aria-hidden /> Check in
            </Link>
            <Link href="/m/renew" className="btn-ghost w-full">
              Renew early
            </Link>
          </>
        ) : (
          <>
            <Link href="/m/renew" className={cn('btn w-full', active ? 'bg-warn text-ink' : 'bg-alert text-white')}>
              {active ? 'Renew now' : 'Renew membership'}
            </Link>
            <Link href="/m/scan" className="btn-ghost w-full">
              <ScanLine size={19} aria-hidden /> Check in
            </Link>
          </>
        )}
      </div>

      <div className="rule mt-10" />

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Invite</h2>
          <Link href="/m/referrals" className="text-sm text-volt underline-offset-4 hover:underline">
            Open
          </Link>
        </div>
        <div className="mt-4 flex gap-1.5" role="img" aria-label={counted + ' of ' + target + ' invites counted'}>
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1', i < counted ? 'bg-volt' : 'bg-ink-line')} />
          ))}
        </div>
        <p className="mt-3 text-sm text-ink-mute">
          {counted} of {target} toward {settings?.referral_reward_days ?? 7} free days
        </p>
      </section>
    </div>
  )
}
