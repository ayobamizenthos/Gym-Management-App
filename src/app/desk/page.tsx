'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, AlertTriangle, RotateCcw, UserX, Volume2, VolumeX } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { playDeskAlert, unlockAudio } from '@/lib/sounds'
import { timeOnly, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import { CHECK_IN_LABEL } from '@/lib/check-ins'
import type { CheckInKind } from '@/lib/types'
import { useLatest } from '@/hooks/useLatest'

const FEED_LENGTH = 40

interface Visit {
  id: string
  kind: CheckInKind
  created_at: string
  full_name: string | null
  phone: string | null
  expires_at: string | null
}

const SKIN: Record<CheckInKind, { accent: string; Icon: typeof CheckCircle2 }> = {
  valid: { accent: 'text-live', Icon: CheckCircle2 },
  expired: { accent: 'text-out', Icon: AlertTriangle },
  duplicate: { accent: 'text-chalk', Icon: RotateCcw },
  no_membership: { accent: 'text-due', Icon: UserX },
}

export default function DeskLive() {
  const [feed, setFeed] = useState<Visit[]>([])
  const [sound, setSound] = useState(true)
  const [live, setLive] = useState(false)
  const soundRef = useLatest(sound)

  useEffect(() => {
    let cancelled = false

    const hydrate = async () => {
      const { data: visits } = await supabase
        .from('check_ins')
        .select('id, kind, created_at, profiles(full_name, phone, expires_at)')
        .order('created_at', { ascending: false })
        .limit(FEED_LENGTH)
      if (cancelled || !visits) return
      setFeed(
        visits.map((visit: Record<string, unknown>) => {
          const member = (visit.profiles ?? {}) as Record<string, unknown>
          return {
            id: visit.id as string,
            kind: visit.kind as CheckInKind,
            created_at: visit.created_at as string,
            full_name: (member.full_name as string) ?? null,
            phone: (member.phone as string) ?? null,
            expires_at: (member.expires_at as string) ?? null,
          }
        })
      )
    }
    void hydrate()

    const channel = supabase
      .channel('desk-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_ins' }, async payload => {
        const scan = payload.new as { id: string; kind: CheckInKind; created_at: string; user_id: string }
        const { data: member } = await supabase
          .from('profiles')
          .select('full_name, phone, expires_at')
          .eq('id', scan.user_id)
          .maybeSingle()
        const visit: Visit = {
          id: scan.id,
          kind: scan.kind,
          created_at: scan.created_at,
          full_name: member?.full_name ?? null,
          phone: member?.phone ?? null,
          expires_at: member?.expires_at ?? null,
        }
        setFeed(prev => [visit, ...prev].slice(0, FEED_LENGTH))
        if (soundRef.current) playDeskAlert(scan.kind)
      })
      .subscribe(status => setLive(status === 'SUBSCRIBED'))

    return () => { cancelled = true; supabase.removeChannel(channel) }
  }, [soundRef])

  const today = feed.filter(visit => new Date(visit.created_at).toDateString() === new Date().toDateString())

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
            <p className="label">Visits today</p>
            <p className="figure text-live">{today.length}</p>
          </div>
          <button
            onClick={() => {
              unlockAudio()
              if (!sound) playDeskAlert('valid')
              setSound(s => !s)
            }}
            className={cn('btn-quiet h-11 px-4', !sound && 'text-out')}
            aria-pressed={sound}
          >
            {sound ? <Volume2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}
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
          {feed.map((visit, i) => {
            const skin = SKIN[visit.kind]
            return (
              <li
                key={visit.id}
                className={cn(
                  'flex items-center gap-4 rounded-lg bg-base-panel px-4 py-3.5',
                  i === 0 && 'animate-rise'
                )}
              >
                <skin.Icon size={26} aria-hidden className={cn('shrink-0', skin.accent)} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-chalk">{visit.full_name ?? 'Member'}</p>
                  <p className="truncate text-sm text-mute">
                    {visit.phone ?? 'No phone'}
                    {visit.expires_at && ` · to ${shortDate(visit.expires_at)}`}
                  </p>
                </div>
                <div className="text-right">
                  <p className={cn('text-sm font-semibold uppercase tracking-wide', skin.accent)}>
                    {CHECK_IN_LABEL[visit.kind]}
                  </p>
                  <p className="text-sm tabular-nums text-mute">{timeOnly(visit.created_at)}</p>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
