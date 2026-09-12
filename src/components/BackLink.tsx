'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

/**
 * Back that cannot strand anyone.
 *
 * Tab switches replace history rather than stacking, so a member who opens a
 * record from a tab has exactly one step behind them. When there is no in-app
 * step - a shared link, a fresh install, a page opened from a notification -
 * this falls back to the list the record belongs to instead of leaving the
 * browser to bounce them back out of the app.
 */
export function BackLink({ fallback, label = 'Back' }: { fallback: string; label?: string }) {
  const router = useRouter()
  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    setCanGoBack(window.history.length > 1 && document.referrer.startsWith(window.location.origin))
  }, [])

  const className = 'inline-flex min-h-[44px] items-center gap-2 text-sm text-mute transition-colors hover:text-chalk'

  if (!canGoBack) {
    return (
      <Link href={fallback} className={className}>
        <ArrowLeft size={16} aria-hidden /> {label}
      </Link>
    )
  }

  return (
    <button onClick={() => router.back()} className={className}>
      <ArrowLeft size={16} aria-hidden /> {label}
    </button>
  )
}
