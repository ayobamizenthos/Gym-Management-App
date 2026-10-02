'use client'

import Image from 'next/image'
import { Share2 } from 'lucide-react'
import { useInstallPrompt } from '@/hooks/useInstallPrompt'
import { useGymName } from '@/hooks/useSettings'

/** The lasting way to install, on Account, for whoever let the passing card go by. Gone once installed. */
export function InstallRow() {
  const { available, iosHint, install } = useInstallPrompt()
  const gymName = useGymName()
  if (!available) return null

  return (
    <section className="mt-8">
      <h2 className="text-xl">App</h2>
      <div className="mt-3 flex items-center gap-3.5 rounded-lg bg-base-panel px-4 py-3">
        <Image src="/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-[11px]" />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">Install {gymName} app</p>
          {iosHint && (
            <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[13px] text-mute">
              Tap <Share2 size={13} aria-hidden /> in Safari, then Add to Home Screen
            </p>
          )}
        </div>
        {!iosHint && (
          <button type="button" onClick={() => void install()} className="h-10 shrink-0 rounded-full bg-live px-5 text-[14px] font-bold text-ink">
            Install
          </button>
        )}
      </div>
    </section>
  )
}
