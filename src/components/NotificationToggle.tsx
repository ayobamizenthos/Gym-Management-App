'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { unlockAudio } from '@/lib/sounds'
import { enablePush, disablePush, pushState, syncSubscription, type PushState } from '@/lib/push'
import { cn } from '@/lib/cn'

const isBrave = () => 'brave' in navigator

/** Says exactly what to change on this phone, since the app cannot change it. */
function blockedMessage(state: PushState) {
  if (state === 'blocked' && isBrave()) {
    return { tone: 'bad' as const, title: 'Brave blocks notifications', message: 'In Brave settings, open Privacy and turn on Google services for push messaging.' }
  }
  if (state === 'blocked') {
    return { tone: 'bad' as const, title: 'This browser blocks notifications', message: 'Open the app in Chrome or Safari to get them.' }
  }
  return { tone: 'bad' as const, title: 'Notifications are off for this site', message: 'Allow them in your browser settings, then try again.' }
}

export function NotificationToggle() {
  const { profile, refresh } = useAuth()
  const push = useToasts(s => s.push)
  const [on, setOn] = useState(true)
  const [permission, setPermission] = useState<PushState>('default')
  const [busy, setBusy] = useState(false)
  // where the switch is heading while the phone registers, shown straight away
  const [heading, setHeading] = useState<boolean | null>(null)
  // whether this phone is actually registered, not just allowed to be
  const [registered, setRegistered] = useState(false)

  useEffect(() => {
    if (profile) setOn(profile.notifications_enabled !== false)
  }, [profile])

  useEffect(() => {
    setPermission(pushState())
    void syncSubscription().then(setRegistered, () => setRegistered(false))
  }, [])

  // What the switch shows: saved as on, allowed, and this phone registered.
  // Anything less reads as off, so the first tap always means on.
  const checked = on && permission === 'granted' && registered

  const shown = heading ?? checked

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
    setHeading(next)
    try {
      if (next) {
        unlockAudio()
        const granted = await enablePush()
        setPermission(granted)
        if (granted !== 'granted') {
          if (granted !== 'default') push(blockedMessage(granted))
          return
        }
        setRegistered(true)
      } else {
        await disablePush()
        setPermission(pushState())
        setRegistered(false)
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
      setHeading(null)
    }
  }

  return (
    <button
      onClick={() => void toggle()}
      role="switch"
      aria-checked={checked}
      disabled={busy}
      aria-busy={busy}
      className="flex w-full items-center justify-between gap-4 py-3.5 text-left"
    >
      <span className="text-[15px] font-medium">Notifications</span>
      <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors',
        shown ? 'bg-live' : 'bg-edge', busy && 'animate-pulse')}>
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-chalk shadow transition-all',
            shown ? 'left-[22px]' : 'left-0.5'
          )}
        />
      </span>
    </button>
  )
}
