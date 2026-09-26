'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowUpRight, CalendarRange } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { naira, daysLeft, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import type { Bucket } from '@/components/overview/RevenueChart'
import type { Profile } from '@/lib/types'

const RevenueChart = dynamic(
  () => import('@/components/overview/RevenueChart').then(chart => chart.RevenueChart),
  { ssr: false, loading: () => <div className="h-full animate-pulse rounded-sm bg-base-raised" /> }
)

interface Summary {
  grain: 'day' | 'month'
  series: Bucket[]
  revenue: string
  revenue_all: string
  members_total: number
  members_active: number
  members_expired: number
  joined_period: number
  renewals_due: number
  visits_period: number
  visits_today: number
  pending_payments: number
  referrals_rewarded: number
}

type RangeKey = '7d' | '30d' | 'custom'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'custom', label: 'Pick dates' },
]

const RANGE_DAYS: Record<Exclude<RangeKey, 'custom'>, number> = { '7d': 7, '30d': 30 }
const EXPIRING_LIMIT = 8
const EXPIRING_SOON_DAYS = 5
const DAY_MS = 86_400_000

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function windowFor(range: RangeKey, from: string, to: string) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  if (range === 'custom') {
    if (!from || !to) return null
    const start = new Date(from + 'T00:00:00')
    const finish = new Date(to + 'T23:59:59')
    return finish > start ? { from: start, to: finish } : null
  }
  const start = startOfDay(new Date())
  start.setDate(start.getDate() - (RANGE_DAYS[range] - 1))
  return { from: start, to: end }
}

const tickFor = (bucket: string, grain: 'day' | 'month') => {
  const d = new Date(grain === 'month' ? bucket + '-01' : bucket)
  return grain === 'month'
    ? d.toLocaleDateString('en-NG', { month: 'short' })
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

interface Props {
  /** The workspace the tiles link into, so the desk never lands on admin-only routes. */
  base: '/admin' | '/desk'
}

export function OverviewScreen({ base }: Props) {
  const [range, setRange] = useState<RangeKey>('30d')
  const [from, setFrom] = useState(() => isoDay(new Date(Date.now() - (RANGE_DAYS['30d'] - 1) * DAY_MS)))
  const [to, setTo] = useState(() => isoDay(new Date()))
  const [summary, setSummary] = useState<Summary | null>(null)
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [expiring, setExpiring] = useState<Profile[]>([])

  const span = useMemo(() => windowFor(range, from, to), [range, from, to])

  useEffect(() => {
    if (!span) return
    let current = true
    setFailed(false)
    void supabase
      .rpc('admin_summary', { p_from: span.from.toISOString(), p_to: span.to.toISOString() })
      .then(({ data, error }) => {
        if (!current) return
        if (error || !data) setFailed(true)
        else setSummary(data as Summary)
      })
    return () => {
      current = false
    }
  }, [span, attempt])

  useEffect(() => {
    void supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .not('expires_at', 'is', null)
      .gte('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(EXPIRING_LIMIT)
      .then(({ data }) => setExpiring((data ?? []) as Profile[]))
  }, [])

  if (!summary) {
    if (!failed) return <Loader />
    return (
      <div className="py-20 text-center">
        <p className="text-[15px] text-mute">The overview could not be loaded.</p>
        <button onClick={() => setAttempt(n => n + 1)} className="btn-quiet mt-4">Try again</button>
      </div>
    )
  }

  const series = summary.series ?? []
  const peak = Math.max(...series.map(b => Number(b.total)), 0)
  const busiest = series.reduce<Bucket | null>(
    (best, b) => (best === null || Number(b.total) > Number(best.total) ? b : best),
    null
  )
  const formatTick = (bucket: string) => tickFor(bucket, summary.grain)

  return (
    <div className="animate-rise">
      <h1 className="text-3xl lg:text-4xl">Overview</h1>

      <section className="mt-5 rounded-lg bg-base-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p className="label">Revenue</p>
            <p className="font-display text-4xl leading-none tabular-nums text-live sm:text-5xl">
              {naira(summary.revenue)}
            </p>
          </div>
          <p className="pb-1 text-sm text-mute">{naira(summary.revenue_all)} all time</p>
        </div>

        <div className="mt-4 flex gap-1">
          {RANGES.map(option => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
              className={range === option.key ? 'seg-on' : 'seg-off'}
            >
              {option.key === 'custom' && <CalendarRange size={14} aria-hidden />}
              {option.label}
            </button>
          ))}
        </div>

        {range === 'custom' && (
          <div className="mt-3 grid animate-rise grid-cols-2 gap-2.5">
            <label className="block">
              <span className="label">From</span>
              <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="field mt-1 h-11" />
            </label>
            <label className="block">
              <span className="label">To</span>
              <input type="date" value={to} min={from} max={isoDay(new Date())} onChange={e => setTo(e.target.value)} className="field mt-1 h-11" />
            </label>
          </div>
        )}

        {failed && <p role="alert" className="mt-3 text-sm text-out">Could not load that period. Showing the last one.</p>}

        <div className="mt-4 h-40 sm:h-52">
          {peak === 0 ? (
            <p className="grid h-full place-items-center text-center text-sm text-mute">
              No payments in this period.
            </p>
          ) : (
            <RevenueChart series={series} peak={peak} formatTick={formatTick} />
          )}
        </div>

        {busiest && peak > 0 && (
          <p className="mt-2 text-sm text-mute">
            Best {summary.grain === 'month' ? 'month' : 'day'}:{' '}
            <span className="text-chalk">{formatTick(busiest.bucket)}</span> at {naira(busiest.total)}
          </p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label="Active members" value={summary.members_active} tone="good" />
        <Tile label="Renewals due" value={summary.renewals_due} tone={summary.renewals_due > 0 ? 'warn' : 'plain'} href={base + '/members?f=due'} />
        <Tile label="Expired" value={summary.members_expired} tone={summary.members_expired > 0 ? 'alert' : 'plain'} />
        <Tile label="Visits today" value={summary.visits_today} tone="plain" />
        <Tile label="New members" value={summary.joined_period} tone="plain" />
        <Tile label="Visits this period" value={summary.visits_period} tone="plain" />
        <Tile label="Payments pending" value={summary.pending_payments} tone={summary.pending_payments > 0 ? 'warn' : 'plain'} href="/desk/payments" />
        <Tile label="Members on file" value={summary.members_total} tone="plain" />
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Expiring next</h2>
          <Link href={base + '/members'} className="-my-2 py-3 text-sm text-live underline-offset-4 hover:underline">
            All members
          </Link>
        </div>
        {expiring.length === 0 ? (
          <p className="mt-4 text-sm text-mute">Nobody is close to expiring.</p>
        ) : (
          <ul role="list" className="mt-4 flex flex-col gap-2">
            {expiring.map(member => {
              const left = daysLeft(member.expires_at) ?? 0
              return (
                <li key={member.id}>
                  <Link
                    href={'/desk/members/' + member.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-base-panel px-4 py-3 transition-colors hover:bg-base-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{member.full_name ?? 'Member'}</span>
                      <span className="block truncate text-sm text-mute">{member.phone ?? 'No phone'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn('block font-display text-2xl tabular-nums', left <= EXPIRING_SOON_DAYS ? 'text-due' : 'text-chalk')}>
                        {left}
                      </span>
                      <span className="block text-[11px] uppercase tracking-[0.18em] text-mute">{plural(left, 'day')} left</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}

function Tile({ label, value, tone, href }: {
  label: string
  value: number
  tone: 'good' | 'warn' | 'alert' | 'plain'
  href?: string
}) {
  const content = (
    <>
      <p className={cn('font-display text-3xl leading-none tabular-nums sm:text-4xl',
        tone === 'good' && 'text-live', tone === 'warn' && 'text-due',
        tone === 'alert' && 'text-out', tone === 'plain' && 'text-chalk')}>
        {value}
      </p>
      <p className="mt-1.5 flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-mute">
        {label}{href && <ArrowUpRight size={12} aria-hidden />}
      </p>
    </>
  )
  const className = 'rounded-lg bg-base-panel px-4 py-3.5'
  return href
    ? <Link href={href} className={cn(className, 'block transition-colors hover:bg-base-raised')}>{content}</Link>
    : <div className={className}>{content}</div>
}
