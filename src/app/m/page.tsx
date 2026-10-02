'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ScanLine, ArrowRight } from 'lucide-react'
import { useAuth } from '@/stores/auth'
import { supabase } from '@/lib/supabase'
import { asName, daysLeft, plural, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useSettings } from '@/hooks/useSettings'
import { TrainingCard } from '@/components/workouts/TrainingCard'

export default function MemberHome() {
  const { profile } = useAuth()
  const [counted, setCounted] = useState(0)

  const { settings } = useSettings()

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
  const soon = active && left <= settings.expiry_notice_days
  const target = settings.referral_target
  const reward = settings.referral_reward_days

  const waiting = !active && (profile?.pending_days ?? 0) > 0
  const state = waiting ? 'ready' : !profile?.expires_at ? 'none' : !active ? 'out' : soon ? 'due' : 'live'
  // asked for once a payment has gone through, never before
  const missing = [
    !profile?.photo_url && 'photo',
    !profile?.address && 'address',
    !profile?.date_of_birth && 'date of birth',
    !profile?.emergency_contact && 'emergency contact',
  ].filter((item): item is string => Boolean(item))
  const accent = { live: 'text-live', due: 'text-due', out: 'text-out', none: 'text-chalk', ready: 'text-chalk' }[state]

  return (
    <div className="animate-rise">
      <section className="relative -mx-5 -mt-[var(--member-top)] overflow-hidden">
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
                {plural(profile?.pending_days ?? 0, 'day')} ready
              </span>
            </div>
          ) : active ? (
            <div className="mt-1 flex items-end gap-3">
              <span className={cn('figure text-[5.5rem]', accent)}>{left}</span>
              <span className="pb-3 text-lg font-semibold text-chalk-dim">
                {plural(left, 'day')} left
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
              'absolute right-14 top-[calc(1.6rem+env(safe-area-inset-top))] text-[12px] font-bold uppercase tracking-[0.14em]',
              state === 'live' && 'text-live',
              state === 'due' && 'text-due',
              state === 'out' && 'text-out',
              state === 'ready' && 'text-chalk'
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

      {profile && active && missing.length > 0 && (
        <Link href="/m/account" className="panel mt-8 flex items-center gap-4 p-5 transition-colors hover:bg-base-raised">
          <span className="min-w-0 flex-1">
            <span className="block text-[17px] font-semibold">Finish your profile</span>
            <span className="mt-1 block text-[14px] text-chalk-dim">Add your {missing.join(', ').replace(/, ([^,]*)$/, ' and $1')} so the desk knows who you are.</span>
          </span>
          <ArrowRight size={20} className="shrink-0 text-mute" aria-hidden />
        </Link>
      )}

      <TrainingCard userId={profile?.id} />

      <Link
        href="/m/referrals"
        className="panel mt-2.5 block p-5 transition-colors hover:bg-base-raised"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl">Train free</h2>
            <p className="mt-1.5 text-[15px] text-chalk-dim">
              Bring {target} {plural(target, 'friend')} onto a monthly plan and take {reward} {plural(reward, 'day')} on us.
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
