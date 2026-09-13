'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { Avatar } from '@/components/Avatar'
import { asName } from '@/lib/format'
import { playReward, unlockAudio } from '@/lib/sounds'
import { cn } from '@/lib/cn'

export interface Celebrant {
  username: string | null
  full_name: string | null
  photo_url: string | null
}

/**
 * Who is celebrating on this floor today, shown once, to someone who has just
 * walked in and is likely standing near them.
 *
 * Deliberately small. A full-screen takeover is something to dismiss; a card
 * this size is something to read, and then look up from.
 */
export function BirthdayCard({ people, onClose }: { people: Celebrant[]; onClose: () => void }) {
  const [showing, setShowing] = useState(false)
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (people.length === 0) return
    // a beat after the scan result clears, so the two never collide
    const entrance = window.setTimeout(() => {
      setShowing(true)
      unlockAudio()
      playReward()
    }, 260)
    return () => window.clearTimeout(entrance)
  }, [people.length])

  // several birthdays cycle rather than stack; the floor is not a list
  useEffect(() => {
    if (!showing || people.length < 2) return
    const turn = window.setInterval(() => setIndex(i => (i + 1) % people.length), 3400)
    return () => window.clearInterval(turn)
  }, [showing, people.length])

  if (people.length === 0) return null

  const person = people[index]
  const name = asName(person.username) ?? person.full_name ?? 'a member'

  const dismiss = () => {
    setShowing(false)
    window.setTimeout(onClose, 220)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed inset-x-0 z-[85] flex justify-center px-4',
        'bottom-[max(1.5rem,calc(env(safe-area-inset-bottom)+1rem))]'
      )}
    >
      <div
        data-card="birthday"
        className={cn(
          'pointer-events-auto relative w-full max-w-[340px] overflow-hidden rounded-2xl',
          'bg-base-raised shadow-[0_20px_50px_-12px_rgba(0,0,0,.9)] transition-all duration-300',
          showing ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
      >
        {/* a slow sheen across the top edge - the only ornament */}
        <span aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-live to-transparent" />
        <span aria-hidden className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-live opacity-[0.10] blur-2xl" />

        <div className="relative flex items-center gap-3.5 p-4">
          <span className="relative shrink-0">
            <Avatar path={person.photo_url} name={person.full_name ?? person.username} size={46} />
            <span
              aria-hidden
              className="absolute -inset-1 rounded-full border border-live/40 animate-pulse-out"
            />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-live">
              Today
            </span>
            <span className="mt-0.5 block truncate text-[15px] font-semibold text-chalk">
              Wish {name} a happy birthday
            </span>
            {people.length > 1 && (
              <span className="mt-1 flex gap-1" aria-hidden>
                {people.map((_, i) => (
                  <span
                    key={i}
                    className={cn('h-0.5 w-4 rounded-full transition-colors', i === index ? 'bg-live' : 'bg-edge')}
                  />
                ))}
              </span>
            )}
          </span>

          <button
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-base-panel hover:text-chalk"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
