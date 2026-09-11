'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { unlockAudio } from '@/lib/sounds'

// In-app reader for the entrance code, for phones whose camera app will not
// open links directly. The normal path is just pointing the camera at it.
export default function ScanPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let scanner: { clear: () => Promise<void> } | null = null
    let done = false

    const boot = async () => {
      try {
        const mod = await import('html5-qrcode')
        const instance = new mod.Html5QrcodeScanner(
          'reader',
          { fps: 10, qrbox: { width: 240, height: 240 } },
          false
        )
        scanner = instance as unknown as { clear: () => Promise<void> }
        instance.render(
          (text: string) => {
            if (done) return
            done = true
            unlockAudio()
            try {
              const url = new URL(text)
              router.replace('/checkin' + (url.search || ''))
            } catch {
              router.replace('/checkin')
            }
          },
          () => {}
        )
      } catch {
        setError('Camera unavailable. Point your phone camera at the code instead.')
      }
    }
    void boot()
    return () => {
      void scanner?.clear().catch(() => {})
    }
  }, [router])

  return (
    <div className="animate-rise">
      <h1 className="text-4xl">Scan to check in</h1>
      <p className="mt-2 text-sm text-ink-mute">Point at the Zenthos Gym code at the entrance.</p>
      <div id="reader" className="mt-6 overflow-hidden border border-ink-line" />
      {error && <p className="mt-4 border-l-2 border-warn pl-3 text-sm text-warn">{error}</p>}
    </div>
  )
}
