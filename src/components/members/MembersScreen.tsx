'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Search, UserPlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useSettings } from '@/hooks/useSettings'
import { Select } from '@/components/Select'
import { Avatar } from '@/components/Avatar'
import { daysLeft, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Branch, Profile } from '@/lib/types'

type Filter = 'all' | 'active' | 'due' | 'expired'
type Standing = 'waiting' | 'none' | 'expired' | 'due' | 'active'

const MEMBER_LIMIT = 5000
const SKELETON_ROWS = 6

/** What each filter means, in the words the desk would use. */
const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Training' },
  { key: 'due', label: 'Due' },
  { key: 'expired', label: 'Lapsed' },
]

const isFilter = (value: string | null): value is Filter => FILTERS.some(option => option.key === value)

function standingOf(member: Profile, noticeDays: number): Standing {
  if (!member.expires_at) return member.pending_days > 0 ? 'waiting' : 'none'
  const left = daysLeft(member.expires_at) ?? 0
  if (left <= 0) return 'expired'
  return left <= noticeDays ? 'due' : 'active'
}

export function MembersScreen() {
  const requestedFilter = useSearchParams().get('f')
  const [members, setMembers] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>(isFilter(requestedFilter) ? requestedFilter : 'all')
  const [branch, setBranch] = useState('all')
  const [ready, setReady] = useState(false)
  const noticeDays = useSettings().settings.expiry_notice_days

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'member')
      .order('created_at', { ascending: false })
      .limit(MEMBER_LIMIT)
    setMembers((data ?? []) as Profile[])
    setReady(true)
  }, [])

  useEffect(() => { void load() }, [load])

  // A member changing their photo or details shows here without a refresh.
  useEffect(() => {
    const channel = supabase
      .channel('members-list')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, change => {
        const next = change.new as Profile
        setMembers(current => current.map(member => (member.id === next.id ? next : member)))
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => void load())
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    void supabase.from('branches').select('*').eq('is_active', true).order('name')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [])

  const standings = useMemo(
    () => new Map(members.map(member => [member.id, standingOf(member, noticeDays)])),
    [members, noticeDays]
  )

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return members.filter(member => {
      if (branch !== 'all' && member.branch_id !== branch) return false
      if (filter !== 'all' && standings.get(member.id) !== filter) return false
      if (!needle) return true
      return [member.full_name, member.phone, member.username]
        .some(value => value?.toLowerCase().includes(needle))
    })
  }, [members, standings, query, filter, branch])

  const counts = useMemo(() => {
    const tally: Partial<Record<Standing, number>> = {}
    standings.forEach(standing => { tally[standing] = (tally[standing] ?? 0) + 1 })
    return tally
  }, [standings])

  return (
    <div className="animate-rise">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl">Members</h1>
          <p className="mt-1 text-sm text-mute">
            {!ready
              ? 'Loading'
              : query || filter !== 'all' || branch !== 'all'
                ? shown.length + ' of ' + members.length + ' shown'
                : members.length + ' ' + plural(members.length, 'member')}
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
            className="field h-11 pl-10 md:text-sm"
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
        {FILTERS.map(option => (
          <button
            key={option.key}
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={cn('px-3.5', filter === option.key ? 'seg-on' : 'seg-off')}
          >
            {option.label}
            {option.key !== 'all' && counts[option.key] ? ' ' + counts[option.key] : ''}
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="mt-5 space-y-2" aria-busy="true" aria-label="Loading members">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="h-[68px] animate-pulse rounded-lg bg-base-panel" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <p className="py-20 text-center text-[15px] text-mute">
          {members.length === 0 ? 'No members yet. Register the first one.' : 'Nobody matches that.'}
        </p>
      ) : (
        <ul role="list" className="mt-4 flex flex-col gap-2">
          {shown.map(member => {
            const standing = standings.get(member.id)
            const left = daysLeft(member.expires_at) ?? 0
            return (
              <li key={member.id}>
                <Link href={'/desk/members/' + member.id} className="row">
                  <Avatar path={member.photo_url} name={member.full_name} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{member.full_name ?? 'Member'}</span>
                    <span className="block truncate text-sm text-mute">{member.phone ?? 'No phone on file'}</span>
                  </span>
                  <span className="shrink-0 text-right">
                    {standing === 'waiting' ? (
                      <>
                        <span className="block font-display text-xl tabular-nums text-chalk">{member.pending_days}</span>
                        <span className="block text-[11px] uppercase tracking-[0.16em] text-mute">
                          {plural(member.pending_days, 'day')} ready
                        </span>
                      </>
                    ) : standing === 'none' ? (
                      <span className="text-xs uppercase tracking-[0.16em] text-mute">No plan</span>
                    ) : (
                      <>
                        <span className={cn('block font-display text-xl tabular-nums',
                          standing === 'active' ? 'text-live' : standing === 'due' ? 'text-due' : 'text-out')}>
                          {left}
                        </span>
                        <span className="block text-[11px] uppercase tracking-[0.16em] text-mute">
                          {standing === 'expired' ? 'lapsed' : plural(left, 'day') + ' left'}
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
