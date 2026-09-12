'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { playGranted, playExpired, playNoMembership, playRepeat, playPaid, unlockAudio } from '@/lib/sounds'
import { cn } from '@/lib/cn'

const CUES = [
  { label: 'Access granted', hint: 'Member is in', play: playGranted, tone: 'good' },
  { label: 'Membership expired', hint: 'Their time has run out', play: playExpired, tone: 'bad' },
  { label: 'No plan yet', hint: 'Send them to the desk', play: playNoMembership, tone: 'warn' },
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
