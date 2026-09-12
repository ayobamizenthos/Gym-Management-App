// Zenthos Gym service worker.
//
// Its whole job is to be awake when the app is not: receive a push, show the
// card, and take the tap to the right screen. It deliberately does not cache
// pages - a membership status served from a stale cache would be a lie, and the
// one thing this app must never do is tell someone they are in when they are not.

const TAG_GROUPS = {
  payment_confirmed: 'money',
  payment_rejected: 'money',
  payment_pending: 'money',
  member_joined: 'members',
  renewals_due: 'membership',
  referral_reward: 'rewards',
  referral_joined: 'rewards',
}

const ROUTES = {
  payment_confirmed: '/m/history',
  payment_rejected: '/m/history',
  payment_pending: '/desk/payments',
  member_joined: '/desk/members',
  renewals_due: '/m/renew',
  referral_reward: '/m/referrals',
  referral_joined: '/m/referrals',
}

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

self.addEventListener('push', event => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { title: 'Zenthos Gym', body: event.data ? event.data.text() : '' }
  }

  const type = payload.type || 'general'
  // Same-kind alerts stack under one tag, so four transfers land as one card
  // that updates rather than four cards burying the phone.
  const tag = TAG_GROUPS[type] || 'general'

  event.waitUntil(
    self.registration.getNotifications({ tag }).then(existing => {
      const stacked = existing.length + 1
      const body = stacked > 1 && payload.stackable !== false
        ? stacked + ' new updates. Latest: ' + (payload.body || '')
        : payload.body || ''

      return self.registration.showNotification(payload.title || 'Zenthos Gym', {
        body,
        tag,
        renotify: true,
        icon: '/icon-192.png',
        badge: '/badge.png',
        // the phone's own alert tone plus a pattern that matches the severity
        vibrate: type === 'payment_rejected' ? [90, 60, 90, 60, 90] : [40, 40, 80],
        timestamp: payload.at ? Date.parse(payload.at) : Date.now(),
        requireInteraction: type === 'payment_pending',
        data: { url: payload.url || ROUTES[type] || '/m', type },
      })
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/m'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      // reuse a tab that is already open rather than piling up new ones
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(target).catch(() => {})
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    })
  )
})

// A subscription can be rotated by the browser at any time. Telling the server
// immediately is what stops a member silently going dark.
self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager
      .subscribe({ userVisibleOnly: true, applicationServerKey: event.oldSubscription?.options?.applicationServerKey })
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
