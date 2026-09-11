'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, AlertTriangle, RotateCcw, UserX, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { playDeskAlert, unlockAudio } from '@/lib/sounds'
import { timeOnly, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { CheckInKind } from '@/lib/types'

interface FeedRow {
  id: string
  kind: CheckInKind
  created_at: string
  full_name: string | null
  member_code: string | null
  expires_at: string | null
}

const SKIN: Record<CheckInKind, { label: string; accent: string; Icon: typeof CheckCircle2 }> = {
  valid:         { label: 'Active',        accent: 'text-volt  border-volt',  Icon: CheckCircle2 },
  expired:       { label: 'Expired',       accent: 'text-alert border-alert', Icon: AlertTriangle },
  duplicate:     { label: 'Repeat scan',   accent: 'text-paper border-ink-line', Icon: RotateCcw },
  no_membership: { label: 'No plan',       accent: 'text-warn  border-warn',  Icon: UserX },
}

export default function DeskLive() {
  const [feed, setFeed] = useState<FeedRow[]>([])
  const [sound, setSound] = useState(true)
  const [live, setLive] = useState(false)
  const soundRef = useRef(sound)
  soundRef.current = sound

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const { data } = await supabase
        .from('check_ins')
        .select('id, kind, created_at, profiles(full_name, member_code, expires_at)')
        .order('created_at', { ascending: false })
        .limit(40)
      if (cancelled || !data) return
      setFeed(
        data.map((r: Record<string, unknown>) => {
          const p = (r.profiles ?? {}) as Record<string, unknown>
          return {
            id: r.id as string,
            kind: r.kind as CheckInKind,
            created_at: r.created_at as string,
            full_name: (p.full_name as string) ?? null,
            member_code: (p.member_code as string) ?? null,
            expires_at: (p.expires_at as string) ?? null,
          }
        })
      )
    }
    void hydrate()

    const channel = supabase
      .channel('desk-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_ins' }, async payload => {
        const row = payload.new as { id: string; kind: CheckInKind; created_at: string; user_id: string }
        const { data: p } = await supabase
          .from('profiles')
          .select('full_name, member_code, expires_at')
          .eq('id', row.user_id)
          .maybeSingle()
        const entry: FeedRow = {
          id: row.id,
          kind: row.kind,
          created_at: row.created_at,
          full_name: p?.full_name ?? null,
          member_code: p?.member_code ?? null,
          expires_at: p?.expires_at ?? null,
        }
        setFeed(prev => [entry, ...prev].slice(0, 40))
        if (soundRef.current) playDeskAlert(row.kind)
      })
      .subscribe(status => setLive(status === 'SUBSCRIBED'))

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [])

  const today = feed.filter(f => new Date(f.created_at).toDateString() === new Date().toDateString())

  return (
    <div onClick={() => unlockAudio()}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl">Live check-in</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-ink-mute">
            <span className={cn('h-2 w-2 rounded-full', live ? 'bg-volt' : 'bg-ink-mute')} />
            {live ? 'Connected' : 'Reconnecting'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-ink-mute">Visits today</p>
            <p className="stat text-volt">{today.length}</p>
          </div>
          <button
            onClick={() => { setSound(s => !s); unlockAudio() }}
            className={cn('btn-ghost h-11 px-4', !sound && 'text-alert border-alert')}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            {sound ? 'Sound on' : 'Muted'}
          </button>
        </div>
      </header>

      <div className="rule mt-6" />

      {feed.length === 0 ? (
        <p className="py-24 text-center text-ink-mute">
          Waiting for the first scan of the day.
        </p>
      ) : (
        <ul className="mt-6 flex flex-col gap-2">
          {feed.map((row, i) => {
            const skin = SKIN[row.kind]
            return (
              <li
                key={row.id}
                className={cn(
                  'flex items-center gap-4 border-l-2 bg-ink-soft px-4 py-3.5',
                  skin.accent,
                  i === 0 && 'animate-rise'
                )}
              >
                <skin.Icon size={26} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-paper">{row.full_name ?? 'Member'}</p>
                  <p className="truncate text-sm text-ink-mute">
                    {row.member_code}
                    {row.expires_at && ` · to ${shortDate(row.expires_at)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-semibold uppercase tracking-wide', skin.accent.split(' ')[0])}>
                    {skin.label}
                  </p>
                  <p className="text-sm tabular-nums text-ink-mute">{timeOnly(row.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
