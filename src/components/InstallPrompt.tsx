'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Share2, X } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useGymName } from '@/hooks/useSettings'

// Offered only while someone is browsing, never over a check-in, a payment or a workout.
const BROWSING_SCREENS = ['/m', '/m/workouts']
const ENGAGED_MS = 10_000
const ON_SCREEN_MS = 8_000
const QUIET_DAYS = 1
const DAY_MS = 86_400_000
const DISMISSED_KEY = 'zg:install-dismissed'

function recentlyShown() {
  try {
    return Date.now() - Number(localStorage.getItem(DISMISSED_KEY) ?? 0) < QUIET_DAYS * DAY_MS
  } catch {
    return true
  }
}

function remember() {
  try {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()))
  } catch {}
}

/** A short-lived card offering the app. The lasting way in is the Install row on Account. */
export function InstallPrompt() {
  const { available, iosHint, install } = useInstallPrompt()
  const path = usePathname()
  const gymName = useGymName()
  const [visible, setVisible] = useState(false)
  const browsing = BROWSING_SCREENS.includes(path)

  useEffect(() => {
    if (!available || !browsing || recentlyShown()) return
    const reveal = window.setTimeout(() => {
      setVisible(true)
      remember()
    }, ENGAGED_MS)
    return () => window.clearTimeout(reveal)
  }, [available, browsing])

  useEffect(() => {
    if (!visible) return
    const leave = window.setTimeout(() => setVisible(false), ON_SCREEN_MS)
    return () => window.clearTimeout(leave)
  }, [visible])

  if (!visible || !browsing || !available) return null

  return (
    <div className="no-print fixed inset-x-3 bottom-[calc(var(--nav-offset)+0.75rem)] z-50 mx-auto max-w-md animate-rise md:bottom-6">
      <div className="flex items-center gap-3 rounded-lg bg-base-raised p-3 pr-2 shadow-lift">
        <Image src="/icon-192.png" alt="" width={44} height={44} className="h-11 w-11 shrink-0 rounded-[12px]" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold">Install {gymName} app</p>
          {iosHint && (
            <p className="flex items-center gap-1 truncate text-[12px] text-mute">
              Tap <Share2 size={12} aria-hidden className="shrink-0" /> then Add to Home Screen
            </p>
          )}
        </div>
        {!iosHint && (
          <button
            type="button"
            onClick={() => {
              setVisible(false)
              void install()
            }}
            className="h-9 shrink-0 rounded-full bg-live px-4 text-[13px] font-bold text-ink"
          >
            Install
          </button>
        )}
        <button type="button" onClick={() => setVisible(false)} aria-label="Not now" className="grid h-9 w-9 shrink-0 place-items-center text-mute">
          <X size={16} aria-hidden />
        </button>
      </div>
    </div>
  )
}
