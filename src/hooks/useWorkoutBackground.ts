'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { useWorkout } from '@/stores/workout'
import { timeOnly } from '@/lib/format'

const WORKOUT_TAG = 'workout'
const LIVE_URL = '/m/workouts/live'

async function workerRegistration() {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return null
  if (Notification.permission !== 'granted') return null
  return (await navigator.serviceWorker.getRegistration('/')) ?? null
}

/**
 * While a workout runs, leaving the app leaves a quiet "in progress" card in the
 * notification shade, and a running rest timer is handed to the server so the
 * phone still buzzes when it ends. Coming back clears both: the screen itself
 * takes over, so nothing ever rings twice.
 */
export function useWorkoutBackground(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return

    const onHidden = async () => {
      const { session, rest } = useWorkout.getState()
      if (!session) return

      if (rest && rest.endsAt > Date.now() + 1500) {
        await supabase.from('rest_alarms').upsert({
          user_id: userId,
          fire_at: new Date(rest.endsAt).toISOString(),
          title: 'Rest over',
          body: rest.label.slice(0, 120),
        })
      }

      const registration = await workerRegistration()
      await registration?.showNotification(`${session.name} in progress`, {
        body: `Started ${timeOnly(new Date(session.startedAt).toISOString())} · tap to carry on`,
        tag: WORKOUT_TAG,
        silent: true,
        icon: '/icon-192.png',
        badge: '/badge.png',
        timestamp: session.startedAt,
        data: { url: LIVE_URL, type: 'workout' },
      } as NotificationOptions)
    }

    const onVisible = async () => {
      const { rest, endRest } = useWorkout.getState()
      if (rest && rest.endsAt <= Date.now()) endRest()
      void supabase.from('rest_alarms').delete().eq('user_id', userId)
      const registration = await workerRegistration()
      const shown = (await registration?.getNotifications({ tag: WORKOUT_TAG })) ?? []
      shown.forEach(notification => notification.close())
    }

    const onChange = () => void (document.visibilityState === 'hidden' ? onHidden() : onVisible())
    document.addEventListener('visibilitychange', onChange)
    return () => document.removeEventListener('visibilitychange', onChange)
  }, [userId])
}
