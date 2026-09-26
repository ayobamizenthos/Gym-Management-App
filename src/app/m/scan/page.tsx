'use client'

import { useState } from 'react'
import { Scanner } from '@/components/Scanner'
import { BackLink } from '@/components/BackLink'
import { unlockAudio } from '@/lib/sounds'
import { useRouter } from 'next/navigation'
import { useToasts } from '@/stores/toast'

export default function ScanPage() {
  const router = useRouter()
  const push = useToasts(s => s.push)
  // the scanner reads once, so a rejected code restarts it for the next try
  const [attempt, setAttempt] = useState(0)

  // Only this gym's own door code opens a check in; any other QR is ignored.
  const openCheckIn = (text: string) => {
    unlockAudio()
    let code: URL | null = null
    try {
      code = new URL(text)
    } catch {
      code = null
    }
    const branch = code?.searchParams.get('b')
    if (!code || code.origin !== window.location.origin || code.pathname !== '/checkin' || !branch) {
      push({ tone: 'bad', title: 'Not a door code', message: 'Scan the code at the gym entrance.' })
      setAttempt(count => count + 1)
      return
    }
    router.replace('/checkin?b=' + encodeURIComponent(branch))
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Scanner key={attempt} onResult={openCheckIn} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="pointer-events-auto">
          <BackLink fallback="/m" label="Back" />
        </span>
        <h1 className="text-xl text-white">Check in</h1>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] px-20 text-center text-sm text-white/75">
        Hold the code in view. It reads automatically.
      </p>
    </div>
  )
}
