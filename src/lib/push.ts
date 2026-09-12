'use client'

import { supabase } from '@/lib/supabase'

/** A VAPID key travels as base64url; PushManager wants raw bytes. */
function toBytes(base64Url: string) {
  const padded = (base64Url + '='.repeat((4 - (base64Url.length % 4)) % 4))
    .replace(/-/g, '+')
    .replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export const pushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export async function registerWorker() {
  if (!pushSupported()) return null
  try {
    return await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    return null
  }
}

export type PushState = 'unsupported' | 'default' | 'granted' | 'denied'

export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported'
  return Notification.permission as PushState
}

/**
 * Asks once, then stores the subscription against the signed-in member. Called
 * on a real tap - browsers refuse the prompt otherwise, and a permission dialog
 * nobody asked for is the fastest way to get it denied forever.
 */
export async function enablePush(): Promise<PushState> {
  if (!pushSupported()) return 'unsupported'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission as PushState

  const registration = (await navigator.serviceWorker.getRegistration('/')) ?? (await registerWorker())
  if (!registration) return 'unsupported'
  await navigator.serviceWorker.ready

  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!key) return 'unsupported'

  const existing = await registration.pushManager.getSubscription()
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: toBytes(key),
    }))

  await saveSubscription(subscription)
  return 'granted'
}

export async function saveSubscription(subscription: PushSubscription) {
  const raw = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
  if (!raw.endpoint || !raw.keys?.p256dh || !raw.keys?.auth) return

  const { data } = await supabase.auth.getUser()
  if (!data.user) return

  await supabase.from('push_subscriptions').upsert(
    {
      user_id: data.user.id,
      endpoint: raw.endpoint,
      p256dh: raw.keys.p256dh,
      auth: raw.keys.auth,
      user_agent: navigator.userAgent.slice(0, 200),
    },
    { onConflict: 'endpoint' }
  )
}

/** Keeps a device that already said yes registered against the current account,
 *  which matters when two people share one phone at the front desk. */
export async function syncSubscription() {
  if (!pushSupported() || Notification.permission !== 'granted') return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await saveSubscription(subscription)
}

export async function disablePush() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (!subscription) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
  await subscription.unsubscribe()
}
