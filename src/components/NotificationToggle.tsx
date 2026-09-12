'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { unlockAudio } from '@/lib/sounds'
import { enablePush, disablePush, pushState, syncSubscription, type PushState } from '@/lib/push'
import { cn } from '@/lib/cn'

export function NotificationToggle() {
  const { profile, refresh } = useAuth()
  const push = useToasts(s => s.push)
  const [on, setOn] = useState(true)
  const [permission, setPermission] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (profile) setOn(profile.notifications_enabled !== false)
  }, [profile])

  useEffect(() => {
    setPermission(pushState())
    void syncSubscription()
  }, [])

  const toggle = async () => {
    if (!profile || busy) return
    const next = !on
    setBusy(true)

    if (next) {
      unlockAudio()
      const granted = await enablePush()
      setPermission(granted)
      if (granted === 'denied') {
        setBusy(false)
        push({
          tone: 'bad',
          title: 'Blocked by your phone',
          message: 'Turn notifications on for this site in your browser settings, then try again.',
        })
        return
      }
    } else {
      await disablePush()
      setPermission(pushState())
    }

    setOn(next)
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

  const blocked = permission === 'denied'
  const unsupported = permission === 'unsupported'

  return (
    <button
      onClick={() => void toggle()}
      role="switch"
      aria-checked={on && permission === 'granted'}
      disabled={busy || unsupported}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left disabled:opacity-60"
    >
      <span className="min-w-0">
        <span className="block text-[15px] font-medium">Notification sounds and pop-ups</span>
        <span className="block text-sm text-mute">
          {unsupported
            ? 'This browser cannot show notifications.'
            : blocked
              ? 'Blocked in your browser settings.'
              : on && permission === 'granted'
                ? 'On your phone, even when the app is closed.'
                : on
                  ? 'Tap to also get them when the app is closed.'
                  : 'Quiet. They still collect in Alerts.'}
        </span>
      </span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors',
        on && permission === 'granted' ? 'bg-live' : 'bg-edge')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-chalk shadow transition-all',
            on && permission === 'granted' ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  )
}
