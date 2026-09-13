'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import type { Toast } from '@/stores/toast'
import { playNewMember, playPaid, playReward, playRepeat, playNoMembership, unlockAudio } from '@/lib/sounds'
import { registerWorker, syncSubscription } from '@/lib/push'

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
  const { session, role, profile } = useAuth()
  const push = useToasts(s => s.push)
  const router = useRouter()
  const roleRef = useRef(role)
  roleRef.current = role
  // read through a ref so flipping the preference does not tear down the channel
  const quietRef = useRef(false)
  quietRef.current = profile?.notifications_enabled === false

  // Browsers keep audio muted until the page has been touched, so the very first
  // interaction of the session primes it - by the time an alert lands it is armed.
  // The worker has to be registered before a push can ever arrive, and the
  // device re-registered against whoever is signed in now.
  useEffect(() => {
    if (!session?.user.id) return
    void registerWorker().then(() => syncSubscription())
  }, [session?.user.id])

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
          // Muted means quiet, not blind: the row is already in the inbox and
          // the badge still counts it, so nothing is lost.
          if (!quietRef.current) {
            alert.sound()
            navigator.vibrate?.(alert.buzz)
            push({ tone: alert.tone, title: row.title, message: row.message })
          }
          if (row.type === 'payment_pending' && roleRef.current !== 'member') router.refresh()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [session?.user.id, push, router])

  return null
}
