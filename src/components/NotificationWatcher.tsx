'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import type { Toast } from '@/stores/toast'
import { playNewMember, playPaid, playReward, playRepeat, playNoMembership, unlockAudio } from '@/lib/sounds'
import { registerWorker, syncSubscription } from '@/lib/push'
import { useLatest } from '@/hooks/useLatest'

interface Alert {
  sound: () => void
  tone: Toast['tone']
  buzz: number | number[]
}

const ALERTS: Record<string, Alert> = {
  member_joined:     { sound: playNewMember,     tone: 'good', buzz: 35 },
  payment_pending:   { sound: playPaid,          tone: 'info', buzz: 35 },
  payment_confirmed: { sound: playPaid,          tone: 'good', buzz: 35 },
  payment_rejected:  { sound: playNoMembership,  tone: 'bad',  buzz: [70, 50, 70] },
  referral_reward:   { sound: playReward,        tone: 'good', buzz: [35, 40, 35] },
  referral_joined:   { sound: playReward,        tone: 'good', buzz: [35, 40, 35] },
  birthday:          { sound: playReward,        tone: 'good', buzz: [35, 40, 35] },
  renewals_due:      { sound: playRepeat,        tone: 'info', buzz: 35 },
}

const FALLBACK: Alert = { sound: playRepeat, tone: 'info', buzz: 35 }

/** Live alerts for whoever is signed in. Staff hear members paying and
 *  payments arriving; members hear their own confirmations. */
export function NotificationWatcher() {
  const { session, profile } = useAuth()
  const push = useToasts(s => s.push)
  // read through a ref so flipping the preference does not tear down the channel
  const quietRef = useLatest(profile?.notifications_enabled === false)

  // registered before any push can arrive, and re-registered to whoever is signed in
  useEffect(() => {
    if (!session?.user.id) return
    void registerWorker().then(() => syncSubscription())
  }, [session?.user.id])

  // browsers keep audio muted until the first touch of the session
  useEffect(() => {
    const prime = () => unlockAudio()
    const options = { once: true, passive: true } as const
    window.addEventListener('pointerdown', prime, options)
    window.addEventListener('keydown', prime, options)
    return () => {
      window.removeEventListener('pointerdown', prime)
      window.removeEventListener('keydown', prime)
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id
    if (!userId) return

    const channel = supabase
      .channel('alerts:' + userId)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + userId },
        payload => {
          const row = payload.new as { type: string; title: string; message: string }
          const alert = ALERTS[row.type] ?? FALLBACK
          // muted still lands in the inbox and the badge
          if (!quietRef.current) {
            alert.sound()
            navigator.vibrate?.(alert.buzz)
            push({ tone: alert.tone, title: row.title, message: row.message })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user.id, push, quietRef])

  return null
}
