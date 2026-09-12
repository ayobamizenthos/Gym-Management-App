'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useCached } from '@/hooks/useCached'
import { Select } from '@/components/Select'
import { daysLeft } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Branch, Profile, Settings } from '@/lib/types'

type Filter = 'all' | 'active' | 'due' | 'expired' | 'waiting'

/** What each filter means, in the words the desk would use. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Training' },
  { key: 'due', label: 'Ending soon' },
  { key: 'expired', label: 'Lapsed' },
  { key: 'waiting', label: 'Not started' },
]

export function MembersScreen() {
  const [rows, setRows] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [branch, setBranch] = useState('all')
  const [ready, setReady] = useState(false)

  const { data: settings } = useCached<Settings>('settings', async () => {
    const { data } = await supabase.from('settings').select('*').maybeSingle()
    return data as Settings
  })

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .limit(5000)
    setRows((data ?? []) as Profile[])
    setReady(true)
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void supabase.from('branches').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [])

  const notice = settings?.expiry_notice_days ?? 5

  /** Lapsed means their time ran out. Ending soon means it is about to. */
  const stateOf = (m: Profile) => {
    const left = daysLeft(m.expires_at)
    if (!m.expires_at) return m.pending_days > 0 ? 'waiting' : 'none'
    if ((left ?? 0) <= 0) return 'expired'
    return left! <= notice ? 'due' : 'active'
  }

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter(m => {
      if (branch !== 'all' && m.branch_id !== branch) return false
      if (filter !== 'all' && stateOf(m) !== filter) return false
      if (!needle) return true
      return [m.full_name, m.phone, m.username].filter(Boolean)
        .some(v => String(v).toLowerCase().includes(needle))
    })
    // stateOf closes over notice, which is the only input that matters here
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, filter, branch, notice])

  const counts = useMemo(() => {
    const tally: Record<string, number> = {}
    rows.forEach(m => { const k = stateOf(m); tally[k] = (tally[k] ?? 0) + 1 })
    return tally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, notice])

  return (
    <div className="animate-rise">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl">Members</h1>
          <p className="mt-1 text-sm text-mute">
            {query || filter !== 'all' || branch !== 'all'
              ? shown.length + ' of ' + rows.length + ' members'
              : rows.length + (rows.length === 1 ? ' member' : ' members')}
          </p>
        </div>
        <Link href="/desk/members/new" className="btn-primary h-11 shrink-0 px-4 text-sm">
          <UserPlus size={17} aria-hidden /> Register
        </Link>
      </header>

      <div className="mt-5 flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search name or phone"
            aria-label="Search members"
            className="field h-11 pl-10 text-sm"
          />
        </div>
        {branches.length > 1 && (
          <Select
            value={branch}
            label="Branch"
            onChange={setBranch}
            className="w-[42%] max-w-[190px] shrink-0 [&_button]:h-11 [&_button]:text-sm"
            options={[{ value: 'all', label: 'All branches' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
          />
        )}
      </div>

      <div className="no-scrollbar mt-3 flex gap-1 overflow-x-auto">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={cn('h-9 px-3.5 text-[13px]', filter === f.key ? 'seg-on' : 'seg-off')}
          >
            {f.label}
            {f.key !== 'all' && counts[f.key] ? ' ' + counts[f.key] : ''}
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="mt-5 space-y-2" aria-busy="true" aria-label="Loading members">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-lg bg-base-panel" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-20 text-center text-[15px] text-mute">
          {rows.length === 0 ? 'No members yet. Register the first one.' : 'Nobody matches that.'}
        </p>
      ) : (
        <ul role="list" className="mt-4 flex flex-col gap-2">
          {shown.map(m => {
            const state = stateOf(m)
            const left = daysLeft(m.expires_at)
            return (
              <li key={m.id}>
                <Link href={'/desk/members/' + m.id} className="row">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{m.full_name ?? 'Member'}</span>
                    <span className="block truncate text-sm text-mute">{m.phone ?? 'No phone on file'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {state === 'waiting' ? (
                      <>
                        <span className="block font-display text-xl tabular-nums text-chalk">{m.pending_days}</span>
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-mute">ready</span>
                      </>
                    ) : state === 'none' ? (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-mute">No plan</span>
                    ) : (
                      <>
                        <span className={cn('block font-display text-xl tabular-nums',
                          state === 'active' ? 'text-live' : state === 'due' ? 'text-due' : 'text-out')}>
                          {state === 'expired' ? 0 : left}
                        </span>
                        <span className="block text-[10px] uppercase tracking-[0.16em] text-mute">
                          {state === 'expired' ? 'lapsed' : 'days left'}
                        </span>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
