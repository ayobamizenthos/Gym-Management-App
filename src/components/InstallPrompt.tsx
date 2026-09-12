'use client'

import { useEffect, useState } from 'react'
import { Share2, X } from 'lucide-react'
import { cn } from '@/lib/cn'

const REVEAL_DELAY_MS = 2000
const AUTO_COLLAPSE_MS = 4000

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIosSafari(): boolean {
  const ua = window.navigator.userAgent
  return /iPad|iPhone|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function InstallPrompt() {
  const [mounted, setMounted] = useState(false)
  const [collapsed, setCollapsed] = useState(true)
  const [installed, setInstalled] = useState(false)
  const [iosHint, setIosHint] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    setMounted(true)
    setIosHint(isIosSafari())

    const capture = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setInstallEvent(null)
    }
    window.addEventListener('beforeinstallprompt', capture)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', capture)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const canShow = mounted && !installed && !isStandalone() && (Boolean(installEvent) || iosHint)

  // Roll out from the mark a beat after it becomes available, then roll back in
  // on its own so it never sits over the interface.
  useEffect(() => {
    if (!canShow) return
    let collapseTimer: ReturnType<typeof setTimeout>
    const revealTimer = setTimeout(() => {
      setCollapsed(false)
      collapseTimer = setTimeout(() => setCollapsed(true), AUTO_COLLAPSE_MS)
    }, REVEAL_DELAY_MS)
    return () => {
      clearTimeout(revealTimer)
      clearTimeout(collapseTimer)
    }
  }, [canShow])

  if (!canShow) return null

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    await installEvent.userChoice
    setInstallEvent(null)
  }

  return (
    <div className="no-print animate-rise fixed bottom-[calc(74px+env(safe-area-inset-bottom))] left-3 z-50 max-w-[calc(100vw-1.5rem)] md:bottom-6 md:left-6">
      <div className="flex items-center overflow-hidden rounded-full border border-edge bg-base/95 backdrop-blur-md">
        <button
          type="button"
          onClick={collapsed ? () => setCollapsed(false) : undefined}
          aria-label={collapsed ? 'Show install option' : 'Zenthos Gym'}
          className={cn(
            'grid h-12 w-12 shrink-0 place-items-center rounded-full font-display text-xl uppercase tracking-tightest text-live',
            collapsed && 'transition-transform active:scale-95'
          )}
        >
          ZG
        </button>

        <div
          className="grid min-w-0 transition-[grid-template-columns] duration-500 ease-out"
          style={{ gridTemplateColumns: collapsed ? '0fr' : '1fr' }}
        >
          <div className="overflow-hidden">
            <div className="flex items-center gap-2 pr-1.5">
              {iosHint ? (
                <p className="flex min-w-0 flex-1 items-center gap-1 truncate text-[13px]">
                  Tap
                  <Share2 size={13} aria-hidden className="shrink-0" />
                  then <span className="font-semibold">Add to Home Screen</span>
                </p>
              ) : (
                <p className="min-w-0 flex-1 truncate text-[13px] font-medium">Install Zenthos Gym</p>
              )}

              {!iosHint && (
                <button
                  type="button"
                  onClick={() => void install()}
                  className="flex h-9 shrink-0 items-center rounded-full bg-live px-4 text-[13px] font-bold uppercase text-ink"
                >
                  Install
                </button>
              )}

              <button
                type="button"
                onClick={() => setCollapsed(true)}
                aria-label="Collapse"
                className="flex h-9 w-9 shrink-0 items-center justify-center text-mute transition-colors hover:text-chalk"
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
