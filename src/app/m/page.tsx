'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ScanLine, ArrowRight } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { asName, daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useCached } from '@/hooks/useCached'
import type { Settings } from '@/lib/types'

export default function MemberHome() {
  const { profile } = useAuth()
  const [counted, setCounted] = useState(0)

  const { data: settings } = useCached<Settings>('settings', async () => {
    const { data } = await supabase.from('settings').select('*').maybeSingle()
    return data as Settings
  })

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

  const waiting = !active && (profile?.pending_days ?? 0) > 0
  const state = waiting ? 'ready' : !profile?.expires_at ? 'none' : !active ? 'out' : soon ? 'due' : 'live'
  const accent = { live: 'text-live', due: 'text-due', out: 'text-out', none: 'text-chalk', ready: 'text-chalk' }[state]

  return (
    <div className="animate-rise">
      {/* Photographic header. The figure sits on the image, not inside a box. */}
      <section className="relative -mx-5 -mt-6 overflow-hidden">
        <Image
          src="/img/weights.jpg"
          quality={70}
          alt=""
          width={1600}
          height={997}
          priority
          className="h-64 w-full object-cover opacity-45"
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-base/20" />

        <div className="absolute inset-x-0 bottom-0 px-5 pb-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.22em] text-mute">
            {asName(profile?.username) ?? profile?.full_name ?? 'Member'}
          </p>
          {waiting ? (
            <div className="mt-1 flex items-end gap-3">
              <span className={cn('figure text-[5.5rem]', accent)}>{profile?.pending_days}</span>
              <span className="pb-3 text-lg font-semibold text-chalk-dim">
                {profile?.pending_days === 1 ? 'day ready' : 'days ready'}
              </span>
            </div>
          ) : active ? (
            <div className="mt-1 flex items-end gap-3">
              <span className={cn('figure text-[5.5rem]', accent)}>{left}</span>
              <span className="pb-3 text-lg font-semibold text-chalk-dim">
                {left === 1 ? 'day left' : 'days left'}
              </span>
            </div>
          ) : profile?.expires_at ? (
            <div className="mt-1 flex items-end gap-3">
              <span className={cn('figure text-[5.5rem]', accent)}>0</span>
              <span className="pb-3 text-lg font-semibold text-chalk-dim">days left</span>
            </div>
          ) : (
            <h1 className="mt-2 text-5xl">No plan yet</h1>
          )}
          <p className="mt-1 text-[15px] text-chalk-dim">
            {waiting
              ? 'Your time starts the first time you scan in.'
              : profile?.expires_at
                ? active
                  ? 'Runs to ' + shortDate(profile.expires_at)
                  : 'Ended ' + shortDate(profile.expires_at)
                : 'Pick a plan to start training.'}
          </p>
        </div>

        {state !== 'none' && (
          <span
            className={cn(
              'absolute right-5 top-5 rounded-full px-3 py-1 text-[12px] font-semibold uppercase tracking-wide backdrop-blur',
              state === 'live' && 'bg-live-tint text-live',
              state === 'due' && 'bg-due-tint text-due',
              state === 'out' && 'bg-out-tint text-out',
              state === 'ready' && 'bg-base-raised text-chalk'
            )}
          >
            {state === 'live' ? 'Active' : state === 'due' ? 'Expiring' : state === 'ready' ? 'Ready' : 'Expired'}
          </span>
        )}
      </section>

      <div className="mt-6 flex flex-col gap-2.5">
        {state === 'live' || state === 'ready' ? (
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
              {state === 'due' ? 'Renew now' : 'Choose a plan'}
            </Link>
            <Link href="/m/scan" className="btn-quiet w-full">
              <ScanLine size={18} aria-hidden /> Check in
            </Link>
          </>
        )}
      </div>

      <Link
        href="/m/referrals"
        className="panel mt-8 block p-5 transition-colors hover:bg-base-raised"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl">Train free</h2>
            <p className="mt-1.5 text-[15px] text-chalk-dim">
              Bring {target} friends onto a monthly plan and take {settings?.referral_reward_days ?? 7} days on us.
            </p>
          </div>
          <ArrowRight size={20} className="mt-1 shrink-0 text-mute" aria-hidden />
        </div>
        <div
          className="mt-5 flex gap-1.5"
          role="img"
          aria-label={counted + ' of ' + target + ' invites counted'}
        >
          {Array.from({ length: target }).map((_, i) => (
            <span key={i} className={cn('h-1 flex-1 rounded-full', i < counted ? 'bg-chalk' : 'bg-edge')} />
          ))}
        </div>
      </Link>
    </div>
  )
}
