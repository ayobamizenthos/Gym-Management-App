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
  phone: string | null
  expires_at: string | null
}

const SKIN: Record<CheckInKind, { label: string; accent: string; Icon: typeof CheckCircle2 }> = {
  valid:         { label: 'Active',        accent: 'text-live  border-live',  Icon: CheckCircle2 },
  expired:       { label: 'Expired',       accent: 'text-out border-out', Icon: AlertTriangle },
  duplicate:     { label: 'Repeat scan',   accent: 'text-chalk border-edge', Icon: RotateCcw },
  no_membership: { label: 'No plan',       accent: 'text-due  border-due',  Icon: UserX },
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
        .select('id, kind, created_at, profiles(full_name, phone, expires_at)')
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
            phone: (p.phone as string) ?? null,
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
          .select('full_name, phone, expires_at')
          .eq('id', row.user_id)
          .maybeSingle()
        const entry: FeedRow = {
          id: row.id,
          kind: row.kind,
          created_at: row.created_at,
          full_name: p?.full_name ?? null,
          phone: p?.phone ?? null,
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
          <h1 className="text-3xl lg:text-4xl">Live check-in</h1>
          <p className="mt-2 flex items-center gap-2 text-sm text-mute">
            <span className={cn('h-2 w-2 rounded-full', live ? 'bg-live' : 'bg-mute')} />
            {live ? 'Connected' : 'Reconnecting'}
          </p>
        </div>
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-mute">Visits today</p>
            <p className="figure text-live">{today.length}</p>
          </div>
          <button
            onClick={() => { setSound(s => !s); unlockAudio() }}
            className={cn('btn-quiet h-11 px-4', !sound && 'text-out border-out')}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            {sound ? 'Sound on' : 'Muted'}
          </button>
        </div>
      </header>


      {feed.length === 0 ? (
        <p className="py-24 text-center text-mute">
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
                  'flex items-center gap-4 rounded-lg bg-base-panel px-4 py-3.5',
                  i === 0 && 'animate-rise'
                )}
              >
                <skin.Icon size={26} aria-hidden className={cn('shrink-0', skin.accent.split(' ')[0])} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-chalk">{row.full_name ?? 'Member'}</p>
                  <p className="truncate text-sm text-mute">
                    {row.phone ?? 'No phone'}
                    {row.expires_at && ` · to ${shortDate(row.expires_at)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-semibold uppercase tracking-wide', skin.accent.split(' ')[0])}>
                    {skin.label}
                  </p>
                  <p className="text-sm tabular-nums text-mute">{timeOnly(row.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
