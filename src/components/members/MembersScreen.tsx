'use client'

import { useCallback, useEffect, useState } from 'react'
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

const PAGE_SIZE = 40
const SEARCH_DELAY_MS = 250
const DAY_MS = 86_400_000
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
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>(isFilter(requestedFilter) ? requestedFilter : 'all')
  const [branch, setBranch] = useState('all')
  const [ready, setReady] = useState(false)
  const [total, setTotal] = useState(0)
  const [counts, setCounts] = useState<Partial<Record<Filter, number>>>({})
  const [loadingMore, setLoadingMore] = useState(false)
  const noticeDays = useSettings().settings.expiry_notice_days

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [query])

  // One query for the list and for every count, so they always agree.
  const membersQuery = useCallback(
    (show: Filter, head: boolean) => {
      let request = supabase
        .from('profiles')
        .select(head ? 'id' : '*', head ? { count: 'exact', head: true } : undefined)
        .eq('role', 'member')
      if (branch !== 'all') request = request.eq('branch_id', branch)
      // characters PostgREST reads as filter syntax are dropped from the search
      const needle = search.trim().replace(/[,()*%\\]/g, '')
      if (needle) {
        const pattern = '%' + needle + '%'
        request = request.or('full_name.ilike.' + pattern + ',phone.ilike.' + pattern + ',username.ilike.' + pattern)
      }
      const now = Date.now()
      const noticeEnds = new Date(now + noticeDays * DAY_MS).toISOString()
      const today = new Date(now).toISOString()
      if (show === 'active') request = request.gt('expires_at', noticeEnds)
      if (show === 'due') request = request.gt('expires_at', today).lte('expires_at', noticeEnds)
      if (show === 'expired') request = request.lte('expires_at', today)
      return request
    },
    [branch, search, noticeDays]
  )

  const loadPage = useCallback(
    async (offset: number) => {
      const { data } = await membersQuery(filter, false)
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1)
      const page = (data ?? []) as unknown as Profile[]
      setMembers(current => (offset === 0 ? page : [...current, ...page]))
    },
    [membersQuery, filter]
  )

  const load = useCallback(async () => {
    const counted = FILTERS.filter(option => option.key !== 'all')
    const [shown, ...perFilter] = await Promise.all([
      membersQuery(filter, true),
      ...counted.map(option => membersQuery(option.key, true)),
    ])
    await loadPage(0)
    setTotal(shown.count ?? 0)
    setCounts(Object.fromEntries(counted.map((option, index) => [option.key, perFilter[index].count ?? 0])))
    setReady(true)
  }, [membersQuery, filter, loadPage])

  useEffect(() => { void load() }, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    await loadPage(members.length)
    setLoadingMore(false)
  }

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
    void supabase.from('branches').select('*').eq('is_active', true).order('created_at')
      .then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [])

  const filtered = Boolean(search.trim()) || filter !== 'all' || branch !== 'all'

  return (
    <div className="animate-rise">
      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl lg:text-4xl">Members</h1>
          <p className="mt-1 text-sm text-mute">
            {!ready
              ? 'Loading'
              : filtered
                ? total + ' ' + plural(total, 'match', 'matches')
                : total + ' ' + plural(total, 'member')}
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

      <div className="no-scrollbar mt-3 flex gap-5 overflow-x-auto border-b border-edge-soft">
        {FILTERS.map(option => (
          <button
            key={option.key}
            onClick={() => setFilter(option.key)}
            aria-pressed={filter === option.key}
            className={filter === option.key ? 'seg-on' : 'seg-off'}
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
      ) : members.length === 0 ? (
        <p className="py-20 text-center text-[15px] text-mute">
          {filtered ? 'Nobody matches that.' : 'No members yet. Register the first one.'}
        </p>
      ) : (
        <ul role="list" className="mt-4 flex flex-col gap-2">
          {members.map(member => {
            const standing = standingOf(member, noticeDays)
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

      {ready && members.length < total && (
        <button onClick={() => void loadMore()} disabled={loadingMore} className="btn-quiet mt-4 w-full">
          {loadingMore ? <span className="dots">Loading</span> : 'Show more'}
        </button>
      )}
    </div>
  )
}
