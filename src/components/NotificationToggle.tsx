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

  // What the switch shows. Saved as on but never granted on this phone reads
  // as off, so the first tap has to mean on.
  const checked = on && permission === 'granted'

  const toggle = async () => {
    if (!profile || busy) return
    // iPhones only deliver web notifications to an app added to the Home Screen
    if (permission === 'unsupported') {
      push({
        tone: 'bad',
        title: 'Install the app first',
        message: 'Tap Share, then Add to Home Screen. Open the app from there and switch this on.',
      })
      return
    }
    const next = !checked
    setBusy(true)
    try {
      if (next) {
        unlockAudio()
        const granted = await enablePush()
        setPermission(granted)
        if (granted !== 'granted') {
          push(
            granted === 'denied'
              ? { tone: 'bad', title: 'Blocked by your phone', message: 'Allow notifications for this site in your browser settings, then try again.' }
              : { tone: 'bad', title: 'Notifications not turned on', message: 'Try again, and tap Allow when your phone asks.' }
          )
          return
        }
      } else {
        await disablePush()
        setPermission(pushState())
      }

      const { error } = await supabase.from('profiles').update({ notifications_enabled: next }).eq('id', profile.id)
      if (error) {
        push({ tone: 'bad', title: 'Not saved', message: 'Check your connection and try again.' })
        return
      }
      setOn(next)
      await refresh()
    } catch {
      push({ tone: 'bad', title: 'Notifications not turned on', message: 'Check your connection and try again.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      role="switch"
      aria-checked={checked}
      disabled={busy}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left disabled:opacity-60"
    >
      <span className="text-[15px] font-medium">Notifications</span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors',
        checked ? 'bg-live' : 'bg-edge')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-chalk shadow transition-all',
            checked ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  )
}
