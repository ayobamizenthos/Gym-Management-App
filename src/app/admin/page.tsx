'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { naira, daysLeft } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import type { Profile } from '@/lib/types'

interface Overview {
  revenue: string
  revenue_all: string
  members_total: number
  members_active: number
  members_expired: number
  joined_period: number
  renewals_due: number
  visits_today: number
  pending_payments: number
  referrals_rewarded: number
}

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
]

export default function AdminOverview() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Overview | null>(null)
  const [due, setDue] = useState<Profile[]>([])

  const load = useCallback(async () => {
    const { data: res } = await supabase.rpc('admin_overview', { p_days: days })
    setData(res as Overview)
  }, [days])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .not('expires_at', 'is', null)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(8)
      .then(({ data: rows }) => setDue((rows ?? []) as Profile[]))
  }, [])

  if (!data) return <Loader />

  return (
    <div className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-4xl lg:text-5xl">Overview</h1>
        <div className="flex gap-1">
          {RANGES.map(r => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className={cn('px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                days === r.days ? 'bg-live text-chalk' : 'text-mute hover:text-chalk')}>
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Revenue leads. No card chrome - the number is the design. */}
      <section className="mt-8">
        <p className="text-xs uppercase tracking-[0.28em] text-mute">Revenue · last {days} days</p>
        <p className="mt-2 font-display text-[4.5rem] leading-none tabular-nums text-live lg:text-[6rem]">
          {naira(data.revenue)}
        </p>
        <p className="mt-1 text-sm text-mute">{naira(data.revenue_all)} all time</p>
      </section>

      <div className="rule mt-9" />

      <section className="mt-7 grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
        <Metric label="Active members" value={data.members_active} tone="good" />
        <Metric label="Renewals due" value={data.renewals_due} tone={data.renewals_due > 0 ? 'warn' : 'plain'} href="/admin/members?f=due" />
        <Metric label="Expired" value={data.members_expired} tone={data.members_expired > 0 ? 'alert' : 'plain'} />
        <Metric label="Visits today" value={data.visits_today} tone="plain" />
        <Metric label="New members" value={data.joined_period} tone="plain" />
        <Metric label="Payments pending" value={data.pending_payments} tone={data.pending_payments > 0 ? 'warn' : 'plain'} href="/desk/payments" />
        <Metric label="Referral rewards" value={data.referrals_rewarded} tone="plain" />
        <Metric label="Members on file" value={data.members_total} tone="plain" />
      </section>

      <div className="rule mt-10" />

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Expiring next</h2>
          <Link href="/admin/members" className="text-sm text-live underline-offset-4 hover:underline">All members</Link>
        </div>
        {due.length === 0 ? (
          <p className="mt-4 text-sm text-mute">Nobody is close to expiring.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {due.map(m => {
              const left = daysLeft(m.expires_at)
              return (
                <li key={m.id} className={cn('flex items-center justify-between border-l-2 bg-base-panel px-4 py-3',
                  (left ?? 99) <= 5 ? 'border-due' : 'border-edge')}>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{m.full_name ?? 'Member'}</span>
                    <span className="block text-sm text-mute">{m.phone ?? 'No phone'}</span>
                  </span>
                  <span className={cn('font-display text-2xl tabular-nums', (left ?? 99) <= 5 ? 'text-due' : 'text-chalk')}>
                    {left}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Metric({ label, value, tone, href }: {
  label: string
  value: number
  tone: 'good' | 'warn' | 'alert' | 'plain'
  href?: string
}) {
  const body = (
    <>
      <p className={cn('font-display text-5xl leading-none tabular-nums',
        tone === 'good' && 'text-live', tone === 'warn' && 'text-due',
        tone === 'alert' && 'text-out', tone === 'plain' && 'text-chalk')}>
        {value}
      </p>
      <p className="mt-2 flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-mute">
        {label}{href && <ArrowUpRight size={13} />}
      </p>
    </>
  )
  return href ? <Link href={href} className="block transition-opacity hover:opacity-80">{body}</Link> : <div>{body}</div>
}
