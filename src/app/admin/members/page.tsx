'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Search } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Branch, Profile, Settings } from '@/lib/types'

type Filter = 'all' | 'active' | 'due' | 'expired'

export default function AdminMembers() {
  const [rows, setRows] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [branch, setBranch] = useState('all')

  useEffect(() => {
    void supabase.from('profiles').select('*').eq('role', 'member')
      .order('created_at', { ascending: false }).limit(5000)
      .then(({ data }) => setRows((data ?? []) as Profile[]))
    void supabase.from('branches').select('*').order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
    void supabase.from('settings').select('*').maybeSingle()
      .then(({ data }) => setSettings(data as Settings))
  }, [])

  const notice = settings?.expiry_notice_days ?? 5

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return rows.filter(r => {
      if (branch !== 'all' && r.branch_id !== branch) return false
      const left = daysLeft(r.expires_at)
      if (filter === 'active' && !(left !== null && left > 0)) return false
      if (filter === 'due' && !(left !== null && left > 0 && left <= notice)) return false
      if (filter === 'expired' && !(r.expires_at && (left ?? 0) <= 0)) return false
      if (!needle) return true
      return [r.full_name, r.phone].filter(Boolean)
        .some(v => String(v).toLowerCase().includes(needle))
    })
  }, [rows, query, filter, branch, notice])

  return (
    <div className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl lg:text-5xl">Members</h1>
          <p className="mt-2 text-sm text-mute">{shown.length} shown of {rows.length}</p>
        </div>
      </header>

      <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto]">
        <div className="relative">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-mute" />
          <input value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Search by name or phone" className="field pl-11" />
        </div>
        {branches.length > 1 && (
          <select value={branch} onChange={e => setBranch(e.target.value)} className="field sm:w-52">
            <option value="all">All branches</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {(['all', 'active', 'due', 'expired'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('h-9 px-4 text-xs font-semibold uppercase tracking-wide transition-colors',
              filter === f ? 'bg-good text-ink' : 'border border-line text-mute hover:text-ink')}>
            {f === 'due' ? 'Renewals due' : f}
          </button>
        ))}
      </div>

      <div className="rule mt-5" />

      <ul className="mt-5 flex flex-col gap-2">
        {shown.map(m => {
          const left = daysLeft(m.expires_at)
          const state = !m.expires_at ? 'none' : (left ?? 0) <= 0 ? 'expired' : left! <= notice ? 'due' : 'ok'
          return (
            <li key={m.id}>
              <Link href={'/desk/members/' + m.id}
                className={cn('flex items-center justify-between gap-4 border-l-2 bg-surface-raised px-4 py-3.5 hover:bg-surface-sunk',
                  state === 'ok' && 'border-good', state === 'due' && 'border-warn',
                  state === 'expired' && 'border-alert', state === 'none' && 'border-line')}>
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{m.full_name ?? 'Member'}</span>
                  <span className="block truncate text-sm text-mute">
                    {m.phone ?? 'No phone on file'}
                    
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  {m.expires_at ? (
                    <span className={cn('font-display text-2xl tabular-nums',
                      state === 'ok' ? 'text-good' : state === 'due' ? 'text-warn' : 'text-alert')}>{left}</span>
                  ) : (
                    <span className="text-xs uppercase tracking-[0.18em] text-mute">No plan</span>
                  )}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
