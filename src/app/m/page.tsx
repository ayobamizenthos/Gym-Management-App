'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ScanLine } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Settings } from '@/lib/types'

const firstName = (name: string | null | undefined) => (name ?? 'there').trim().split(' ')[0]

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
      <h1 className="text-3xl">Hi {firstName(profile?.full_name)}</h1>

      <section
        className={cn(
          'mt-6 rounded-lg px-5 py-6',
          !profile?.expires_at ? 'bg-surface-raised' : !active ? 'bg-alert-tint' : soon ? 'bg-warn-tint' : 'bg-good-tint'
        )}
      >
        {profile?.expires_at ? (
          <>
            <p className="flex items-baseline gap-2">
              <span
                className={cn(
                  'stat text-6xl',
                  !active ? 'text-alert' : soon ? 'text-warn' : 'text-good'
                )}
              >
                {left}
              </span>
              <span className="text-lg font-semibold text-ink-soft">
                {left === 1 ? 'day left' : 'days left'}
              </span>
            </p>
            <p className="mt-2 text-[15px] text-ink-soft">
              {active
                ? 'Your membership runs to ' + shortDate(profile.expires_at)
                : 'Ended ' + shortDate(profile.expires_at)}
            </p>
          </>
        ) : (
          <>
            <p className="text-2xl font-semibold">No plan yet</p>
            <p className="mt-1 text-[15px] text-ink-soft">Pick a plan to start training.</p>
          </>
        )}
      </section>

      <div className="mt-5 flex flex-col gap-2.5">
        {active && !soon ? (
          <>
            <Link href="/m/scan" className="btn-primary w-full">
              <ScanLine size={18} aria-hidden /> Check in
            </Link>
            <Link href="/m/renew" className="btn-quiet w-full">
              Renew early
            </Link>
          </>
        ) : (
          <>
            <Link href="/m/renew" className="btn-primary w-full">
              {active ? 'Renew now' : 'Choose a plan'}
            </Link>
            <Link href="/m/scan" className="btn-quiet w-full">
              <ScanLine size={18} aria-hidden /> Check in
            </Link>
          </>
        )}
      </div>

      <section className="mt-9">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl">Invite friends</h2>
          <Link href="/m/referrals" className="text-sm font-semibold text-ink underline-offset-4 hover:underline">
            Open
          </Link>
        </div>
        <p className="mt-1 text-[15px] text-mute">
          {target} friends on a monthly plan earns you {settings?.referral_reward_days ?? 7} free days.
        </p>
        <div
          className="mt-3 flex gap-1.5"
          role="img"
          aria-label={counted + ' of ' + target + ' invites counted'}
        >
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-1.5 flex-1 rounded-full', i < counted ? 'bg-ink' : 'bg-line')} />
          ))}
        </div>
      </section>
    </div>
  )
}
