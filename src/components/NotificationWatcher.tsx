'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { playNewMember, playPaid, playReward, playRepeat } from '@/lib/sounds'

const SOUND: Record<string, () => void> = {
  member_joined: playNewMember,
  payment_pending: playPaid,
  payment_confirmed: playPaid,
  referral_reward: playReward,
}

/** Live alerts for whoever is signed in. Staff hear members joining and
 *  payments arriving; members hear their own confirmations. */
export function NotificationWatcher() {
  const { session, role } = useAuth()
  const push = useToasts(s => s.push)
  const router = useRouter()
  const roleRef = useRef(role)
  roleRef.current = role

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
          ;(SOUND[row.type] ?? playRepeat)()
          if (navigator.vibrate) navigator.vibrate(35)
          push({
            tone: row.type === 'payment_pending' ? 'info' : 'good',
            title: row.title,
            message: row.message,
          })
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
