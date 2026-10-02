// Receives pushes and routes taps. Pages are never cached: a stale membership
// status would let someone through the door who should not be.

// Public key; the service worker needs it to resubscribe without the page.
const VAPID_PUBLIC_KEY = 'BKMxtCubwoIIe8EofLzUeZimmclpLnQNwVnzhA1eNLQSsqjftqfJmL3QKYwgiSdlXNaIeQOi1xpsVvwTs8KOj4E'

const TAG_GROUPS = {
  payment_confirmed: 'money',
  payment_rejected: 'money',
  payment_pending: 'money',
  member_joined: 'members',
  renewals_due: 'membership',
  referral_reward: 'rewards',
  referral_joined: 'rewards',
  birthday: 'rewards',
  rest_over: 'rest',
}

// A finished rest is one alert that replaces the last, never a stack.
const SINGLE = new Set(['rest_over'])

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : '' }
  }

  const type = payload.type || 'general'
  // same-kind alerts stack under one tag instead of burying the phone
  const tag = TAG_GROUPS[type] || 'general'

  event.waitUntil(
    self.registration.getNotifications({ tag }).then(existing => {
      const stacked = SINGLE.has(type) ? 1 : existing.length + 1
      const body = stacked > 1
        ? stacked + ' new updates. Latest: ' + (payload.body || '')
        : payload.body || ''

      return self.registration.showNotification(payload.title || 'New alert', {
        body,
        tag,
        renotify: true,
        icon: '/icon-192.png',
        badge: '/badge.png',
        vibrate: type === 'payment_rejected' ? [90, 60, 90, 60, 90] : type === 'rest_over' ? [220, 110, 220] : [40, 40, 80],
        timestamp: payload.at ? Date.parse(payload.at) : Date.now(),
        requireInteraction: type === 'payment_pending',
        data: { url: payload.url || '/m', type },
      })
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/m'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const open = clients.find(client => 'focus' in client && 'navigate' in client)
      if (!open) return self.clients.openWindow(target)
      return open.focus().then(focused => focused.navigate(target)).catch(() => self.clients.openWindow(target))
    })
  )
})

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: VAPID_PUBLIC_KEY })
      .then(fresh =>
        fetch('/api/push/resubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ old: event.oldSubscription?.endpoint, fresh: fresh.toJSON() }),
        })
      )
      .catch(() => {})
  )
})
