'use client'

import Link from 'next/link'
import { Share2 } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useGymName } from '@/hooks/useSettings'

interface WalkInWelcomeProps {
  branch: string | null
}

/**
 * What a phone camera lands on when nobody is signed in on it.
 *
 * The entrance code is a public sticker, so it gets scanned by three different
 * people: a member whose session has lapsed, someone who has never been here,
 * and anyone who just wants the app. Sending all three to a password box lost
 * the last two.
 */
export function WalkInWelcome({ branch }: WalkInWelcomeProps) {
  const { available, iosHint, install } = useInstallPrompt()
  const gymName = useGymName()
  const next = '/checkin' + (branch ? '?b=' + branch : '')

  return (
    <main className="relative grid min-h-dvh grid-rows-[1fr_auto] overflow-hidden bg-base">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[60vh] bg-live opacity-[0.09] blur-[80px]"
      />

      <section className="relative flex flex-col items-center justify-center px-7 text-center">
        <p className="font-display text-3xl uppercase tracking-tightest text-live">ZG</p>

        <h1 className="animate-lift-1 mt-8 text-[2.75rem] leading-[0.95] sm:text-6xl">
          Train at {gymName}
        </h1>

        <p className="animate-lift-2 mt-5 max-w-[32ch] text-lg text-mute">
          Members scan this code to get in. Pick a plan and you can train today.
        </p>
      </section>

      <footer className="animate-lift-3 relative flex flex-col gap-3 p-6">
        <Link href="/join" className="btn-primary w-full">Sign up</Link>

        <Link href={'/login?next=' + encodeURIComponent(next)} className="btn-quiet w-full">
          I already have a membership
        </Link>

        {available &&
          (iosHint ? (
            <p className="flex items-center justify-center gap-1.5 pt-2 text-[13px] text-mute">
              To keep the app, tap
              <Share2 size={13} aria-hidden className="shrink-0" />
              then <span className="font-semibold text-chalk">Add to Home Screen</span>
            </p>
          ) : (
            <button type="button" onClick={() => void install()} className="btn-quiet w-full">
              Install the app
            </button>
          ))}
      </footer>
    </main>
  )
}
