'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { unlockAudio } from '@/lib/sounds'
import { cn } from '@/lib/cn'

/**
 * Turning alerts off silences the sound and the toast. The alert is still
 * written to the inbox, because someone who muted their phone still has to be
 * able to find out their transfer was rejected.
 */
export function NotificationToggle() {
  const { profile, refresh } = useAuth()
  const push = useToasts(s => s.push)
  const [on, setOn] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setOn(profile.notifications_enabled !== false)
  }, [profile])

  const toggle = async () => {
    if (!profile || busy) return
    const next = !on
    setOn(next)
    setBusy(true)
    if (next) unlockAudio()
    const { error } = await supabase
      .from('profiles')
      .update({ notifications_enabled: next })
      .eq('id', profile.id)
    setBusy(false)
    if (error) {
      setOn(!next)
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    await refresh()
  }

  return (
    <button
      onClick={() => void toggle()}
      role="switch"
      aria-checked={on}
      disabled={busy}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">Alert sounds and pop-ups</span>
        <span className="block text-sm text-mute">
          {on ? 'You hear and see alerts as they arrive.' : 'Alerts arrive quietly, in Alerts only.'}
        </span>
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', on ? 'bg-live' : 'bg-edge')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-chalk shadow transition-all',
            on ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  )
}
