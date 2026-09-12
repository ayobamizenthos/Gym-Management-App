'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { ArrowUpRight, CalendarRange } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { naira, daysLeft } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import type { Profile } from '@/lib/types'

interface Bucket {
  bucket: string
  total: number
}

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

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const iso = (d: Date) => d.toISOString().slice(0, 10)

function windowFor(range: RangeKey, from: string, to: string) {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  if (range === 'custom') {
    if (!from || !to) return null
    const a = new Date(from + 'T00:00:00')
    const b = new Date(to + 'T23:59:59')
    return b > a ? { from: a, to: b } : null
  }
  const start = startOfDay(new Date())
  if (range === '7d') start.setDate(start.getDate() - 6)
  if (range === '30d') start.setDate(start.getDate() - 29)
  return { from: start, to: end }
}

const tickFor = (bucket: string, grain: 'day' | 'month') => {
  const d = new Date(grain === 'month' ? bucket + '-01' : bucket)
  return grain === 'month'
    ? d.toLocaleDateString('en-NG', { month: 'short' })
    : d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export default function AdminOverview() {
  const [range, setRange] = useState<RangeKey>('30d')
  const [from, setFrom] = useState(() => iso(new Date(Date.now() - 29 * 86_400_000)))
  const [to, setTo] = useState(() => iso(new Date()))
  const [data, setData] = useState<Summary | null>(null)
  const [due, setDue] = useState<Profile[]>([])

  const span = useMemo(() => windowFor(range, from, to), [range, from, to])

  const load = useCallback(async () => {
    if (!span) return
    const { data: res } = await supabase.rpc('admin_summary', {
      p_from: span.from.toISOString(),
      p_to: span.to.toISOString(),
    })
    if (res) setData(res as Summary)
  }, [span])

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

  const series = data.series ?? []
  const peak = Math.max(...series.map(b => Number(b.total)), 0)
  const busiest = series.reduce<Bucket | null>(
    (best, b) => (best === null || Number(b.total) > Number(best.total) ? b : best),
    null
  )

  return (
    <div className="animate-rise">
      <h1 className="text-3xl lg:text-4xl">Overview</h1>

      {/* Revenue leads, but as a shape you can read at a glance rather than a wall of digits. */}
      <section className="mt-5 rounded-lg bg-base-panel p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <div>
            <p className="label">Revenue</p>
            <p className="font-display text-4xl leading-none tabular-nums text-live sm:text-5xl">
              {naira(data.revenue)}
            </p>
          </div>
          <p className="pb-1 text-sm text-mute">{naira(data.revenue_all)} all time</p>
        </div>

        <div className="mt-4 flex gap-1">
          {RANGES.map(option => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              aria-pressed={range === option.key}
              className={cn(range === option.key ? 'seg-on' : 'seg-off')}
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
              <input type="date" value={to} min={from} max={iso(new Date())} onChange={e => setTo(e.target.value)} className="field mt-1 h-11" />
            </label>
          </div>
        )}

        <div className="mt-4 h-40 sm:h-52">
          {peak === 0 ? (
            <p className="grid h-full place-items-center text-center text-sm text-mute">
              No payments in this period.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 6, right: 2, bottom: 0, left: 2 }}>
                <XAxis
                  dataKey="bucket"
                  tickFormatter={b => tickFor(b, data.grain)}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={24}
                  tick={{ fill: '#8A8A93', fontSize: 11 }}
                />
                <Tooltip cursor={{ fill: 'rgba(53,208,127,.08)' }} content={<ChartTip grain={data.grain} />} />
                <Bar dataKey="total" radius={[5, 5, 0, 0]} maxBarSize={44}>
                  {series.map(b => (
                    <Cell key={b.bucket} fill={Number(b.total) === peak ? '#35D07F' : '#2C6A4E'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {busiest && peak > 0 && (
          <p className="mt-2 text-sm text-mute">
            Best {data.grain === 'month' ? 'month' : 'day'}:{' '}
            <span className="text-chalk">{tickFor(busiest.bucket, data.grain)}</span> at {naira(busiest.total)}
          </p>
        )}
      </section>

      <section className="mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Tile label="Active members" value={data.members_active} tone="good" />
        <Tile label="Renewals due" value={data.renewals_due} tone={data.renewals_due > 0 ? 'warn' : 'plain'} href="/admin/members?f=due" />
        <Tile label="Expired" value={data.members_expired} tone={data.members_expired > 0 ? 'alert' : 'plain'} />
        <Tile label="Visits today" value={data.visits_today} tone="plain" />
        <Tile label="New members" value={data.joined_period} tone="plain" />
        <Tile label="Visits this period" value={data.visits_period} tone="plain" />
        <Tile label="Payments pending" value={data.pending_payments} tone={data.pending_payments > 0 ? 'warn' : 'plain'} href="/desk/payments" />
        <Tile label="Members on file" value={data.members_total} tone="plain" />
      </section>

      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl">Expiring next</h2>
          <Link href="/admin/members" className="-my-2 py-2 text-sm text-live underline-offset-4 hover:underline">
            All members
          </Link>
        </div>
        {due.length === 0 ? (
          <p className="mt-4 text-sm text-mute">Nobody is close to expiring.</p>
        ) : (
          <ul role="list" className="mt-4 flex flex-col gap-2">
            {due.map(m => {
              const left = daysLeft(m.expires_at)
              return (
                <li key={m.id}>
                  <Link
                    href={'/desk/members/' + m.id}
                    className="flex items-center justify-between gap-4 rounded-lg bg-base-panel px-4 py-3 transition-colors hover:bg-base-raised"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{m.full_name ?? 'Member'}</span>
                      <span className="block truncate text-sm text-mute">{m.phone ?? 'No phone'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className={cn('block font-display text-2xl tabular-nums', (left ?? 99) <= 5 ? 'text-due' : 'text-chalk')}>
                        {left}
                      </span>
                      <span className="block text-[10px] uppercase tracking-[0.18em] text-mute">days left</span>
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

function ChartTip({
  active,
  payload,
  label,
  grain,
}: {
  active?: boolean
  payload?: { value: number }[]
  label?: string
  grain: 'day' | 'month'
}) {
  if (!active || !payload?.length || !label) return null
  return (
    <div className="rounded-sm border border-edge bg-base-raised px-3 py-2 shadow-lift">
      <p className="text-[11px] uppercase tracking-wide text-mute">{tickFor(label, grain)}</p>
      <p className="font-display text-lg tabular-nums text-live">{naira(payload[0].value)}</p>
    </div>
  )
}

function Tile({ label, value, tone, href }: {
  label: string
  value: number
  tone: 'good' | 'warn' | 'alert' | 'plain'
  href?: string
}) {
  const body = (
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
    ? <Link href={href} className={cn(className, 'block transition-colors hover:bg-base-raised')}>{body}</Link>
    : <div className={className}>{body}</div>
}
