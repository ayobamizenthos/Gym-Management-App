'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

/**
 * A connection indicator, not a paragraph. It appears only while the phone is
 * actually offline and says so the way every other app does: an icon and one
 * word. The app keeps working from what it has cached; anything needing the
 * server simply waits.
 */
export function OfflineFlag() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine)
    sync()
    window.addEventListener('online', sync)
    window.addEventListener('offline', sync)
    return () => {
      window.removeEventListener('online', sync)
      window.removeEventListener('offline', sync)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[95] flex justify-center pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      <span className="flex animate-rise items-center gap-2 rounded-full bg-out-deep px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-lift">
        <WifiOff size={14} aria-hidden />
        Offline
      </span>
    </div>
  )
}
