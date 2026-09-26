'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Share2, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useGymName } from '@/hooks/useSettings'
import { initialsOf } from '@/lib/settings'

const REVEAL_DELAY_MS = 2000
const AUTO_COLLAPSE_MS = 4000
// A walk-in scanning the door code has come to train, not to install anything.
const QUIET_ON = ['/checkin']

export function InstallPrompt() {
  const { available, iosHint, install } = useInstallPrompt()
  const path = usePathname()
  const gymName = useGymName()
  const [collapsed, setCollapsed] = useState(true)

  // Roll out from the mark a beat after it becomes available, then roll back in
  // on its own so it never sits over the interface.
  useEffect(() => {
    if (!available) return
    let collapseTimer: ReturnType<typeof setTimeout>
    const revealTimer = setTimeout(() => {
      setCollapsed(false)
      collapseTimer = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS)
    }, REVEAL_DELAY_MS)
    return () => {
      clearTimeout(revealTimer)
      clearTimeout(collapseTimer)
    }
  }, [available])

  if (!available || QUIET_ON.includes(path)) return null

  return (
    <div className="no-print animate-rise fixed bottom-[calc(var(--nav-offset)+0.75rem)] left-3 z-50 max-w-[calc(100vw-1.5rem)] md:bottom-6 md:left-6">
      <div className="flex items-center overflow-hidden rounded-full border border-edge bg-base/95 backdrop-blur-md">
        <button
          type="button"
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          aria-label={collapsed ? 'Show install option' : gymName}
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl uppercase tracking-tightest text-live',
            collapsed && 'transition-transform active:scale-95'
          )}
        >
          {initialsOf(gymName)}
        </button>

        <div
          className="grid min-w-0 transition-[grid-template-columns] duration-500 ease-out"
          style={{ gridTemplateColumns: collapsed ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 pr-1.5">
              {iosHint ? (
                <p className="flex min-w-0 flex-1 items-center gap-1 truncate text-sm">
                  Tap
                  <Share2 size={13} aria-hidden className="shrink-0" />
                  then <span className="font-semibold">Add to Home Screen</span>
                </p>
              ) : (
                <p className="min-w-0 flex-1 truncate text-sm font-medium">Install {gymName}</p>
              )}

              {!iosHint && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="flex h-11 shrink-0 items-center rounded-full bg-live px-4 text-sm font-bold uppercase text-ink"
                >
                  Install
                </button>
              )}

              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse"
                className="flex h-11 w-11 shrink-0 items-center justify-center text-mute transition-colors hover:text-chalk"
              >
                <X size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
