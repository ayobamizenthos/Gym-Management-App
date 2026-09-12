'use client'

import { Scanner } from '@/components/Scanner'
import { BackLink } from '@/components/BackLink'
import { unlockAudio } from '@/lib/sounds'
import { useRouter } from 'next/navigation'

export default function ScanPage() {
  const router = useRouter()

  const handle = (text: string) => {
    unlockAudio()
    let search = ''
    try {
      search = new URL(text).search
    } catch {
      search = ''
    }
    router.replace('/checkin' + search)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Scanner onResult={handle} />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-2 bg-gradient-to-b from-black/70 to-transparent px-3 pb-10 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="pointer-events-auto">
          <BackLink fallback="/m" label="" />
        </span>
        <h1 className="text-xl text-white">Check in</h1>
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+1.25rem))] px-20 text-center text-sm text-white/75">
        Hold the code in view. It reads automatically.
      </p>
    </div>
  )
}
