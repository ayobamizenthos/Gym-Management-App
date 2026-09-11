'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { Scanner } from '@/components/Scanner'
import { unlockAudio } from '@/lib/sounds'

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
    <div className="-mx-5 -mt-6">
      <div className="flex items-center gap-3 px-5 py-4">
        <button onClick={() => router.back()} aria-label="Back" className="text-mute hover:text-ink">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-2xl">Check in</h1>
      </div>
      <Scanner onResult={handle} />
      <p className="px-5 py-5 text-center text-sm text-mute">
        Hold the code in view. It reads automatically.
      </p>
    </div>
  )
}
