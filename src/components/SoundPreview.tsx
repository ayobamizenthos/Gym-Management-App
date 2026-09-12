'use client'

import { useEffect, useState } from 'react'
import { Play } from 'lucide-react'
import {
  playGranted, playExpired, playNoMembership, playRepeat, playPaid,
  unlockAudio, primeVoice, availableVoices, setVoice, currentVoice, sayNow,
} from '@/lib/sounds'
import { cn } from '@/lib/cn'

const CUES = [
  { label: 'Access granted', hint: 'Member is in', play: playGranted, tone: 'good' },
  { label: 'Membership expired', hint: 'Their time has run out', play: playExpired, tone: 'bad' },
  { label: 'No active subscription', hint: 'Registered, never paid', play: playNoMembership, tone: 'warn' },
  { label: 'Already checked in', hint: 'Second scan today', play: playRepeat, tone: 'plain' },
  { label: 'Payment received', hint: 'Money confirmed', play: playPaid, tone: 'good' },
] as const

const RING = {
  good: 'text-live',
  bad: 'text-out',
  warn: 'text-due',
  plain: 'text-mute',
} as const

/** The door sounds, auditioned from a desk. Nobody should first hear these with
 *  a member standing in front of them. */
export function SoundPreview() {
  const [playing, setPlaying] = useState<string | null>(null)
  const [voices, setVoices] = useState<{ name: string; woman: boolean }[]>([])
  const [chosen, setChosen] = useState<string | null>(null)

  // the engine loads its voices after the page, so this settles once they land
  useEffect(() => {
    const load = () => {
      primeVoice()
      const list = availableVoices()
      if (list.length === 0) return
      setVoices(list.map(v => ({ name: v.name, woman: /(zira|samantha|karen|moira|tessa|fiona|serena|hazel|susan|aria|jenny|libby|sonia|female|woman)/i.test(v.name) })))
      setChosen(currentVoice()?.name ?? null)
    }
    load()
    const timer = window.setTimeout(load, 1200)
    return () => window.clearTimeout(timer)
  }, [])

  const audition = (label: string, play: () => void) => {
    unlockAudio()
    play()
    setPlaying(label)
    window.setTimeout(() => setPlaying(current => (current === label ? null : current)), 1600)
  }

  return (
    <>
      <p className="mb-3 text-[15px] text-chalk-dim">
        Turn your volume up. This is what the floor hears.
      </p>

      {voices.length > 0 && (
        <div className="mb-4">
          <span className="label">Announcement voice</span>
          <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
            {voices.map(v => (
              <button
                key={v.name}
                onClick={() => { unlockAudio(); setVoice(v.name); setChosen(v.name); sayNow('Access granted') }}
                aria-pressed={chosen === v.name}
                className={cn('h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors',
                  chosen === v.name ? 'bg-live text-ink' : 'bg-base-raised text-mute hover:text-chalk')}
              >
                {v.name.replace(/^Microsoft /, '').replace(/ - .*$/, '')}
              </button>
            ))}
          </div>
        </div>
      )}
      <ul role="list" className="flex flex-col gap-1.5">
        {CUES.map(cue => (
          <li key={cue.label}>
            <button
              onClick={() => audition(cue.label, cue.play)}
              className={cn('row w-full text-left', playing === cue.label && 'bg-base-raised')}
            >
              <span
                className={cn(
                  'grid h-9 w-9 shrink-0 place-items-center rounded-full bg-base-raised transition-transform',
                  RING[cue.tone],
                  playing === cue.label && 'scale-110'
                )}
              >
                <Play size={15} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-medium">{cue.label}</span>
                <span className="block truncate text-sm text-mute">{cue.hint}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </>
  )
}
