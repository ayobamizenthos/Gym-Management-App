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

  // Registering an endpoint someone else signed in with moves it to this
  // account, which is what a shared front desk phone needs.
  await supabase.rpc('register_push_device', {
    p_endpoint: raw.endpoint,
    p_p256dh: raw.keys.p256dh,
    p_auth: raw.keys.auth,
    p_agent: navigator.userAgent,
  })
}

/** Stops this phone receiving the signed-out account's alerts. The browser
 *  keeps its permission, so the next person to sign in is registered again. */
export async function forgetDevice() {
  if (!pushSupported()) return
  const registration = await navigator.serviceWorker.getRegistration('/')
  const subscription = await registration?.pushManager.getSubscription()
  if (subscription) await supabase.from('push_subscriptions').delete().eq('endpoint', subscription.endpoint)
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
