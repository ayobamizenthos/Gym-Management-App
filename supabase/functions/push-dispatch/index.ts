import { Buffer } from 'node:buffer'
import { timingSafeEqual } from 'node:crypto'
import webpush from 'npm:web-push@3.6.7'
import { serviceClient } from '../_shared/supabase.ts'
import { alertRoute } from '../../../src/lib/alert-routes.ts'
import { json } from '../_shared/http.ts'

interface QueuedAlert {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  created_at: string
}

interface Device {
  id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth: string
}

// Android holds back normal-priority pushes while the phone dozes.
const URGENT = new Set(['payment_confirmed', 'payment_rejected', 'payment_pending', 'renewals_due'])
const BATCH = 200
const FOUR_WEEKS = 60 * 60 * 24 * 28
const SEND_TIMEOUT_MS = 5000

function configure() {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY')
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
  const subject = Deno.env.get('VAPID_SUBJECT')
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

function authorised(request: Request) {
  const secret = Deno.env.get('PUSH_DISPATCH_SECRET')
  const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || offered.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(offered), Buffer.from(secret))
}

interface RestAlarm {
  user_id: string
  fire_at: string
  title: string
  body: string
}

// A rest alert that arrives late is worse than none: the member has moved on.
const REST_TTL_SECONDS = 60

/** Rest timers that ran out while the app was in the background. Never stored in the inbox. */
async function sendRestAlarms(admin: ReturnType<typeof serviceClient>) {
  const { data } = await admin.rpc('claim_rest_alarms')
  const alarms = (data ?? []) as RestAlarm[]
  if (alarms.length === 0) return 0

  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', alarms.map(alarm => alarm.user_id))
  const devices = (subscriptions ?? []) as Device[]

  const deliveries = alarms.flatMap(alarm =>
    devices
      .filter(device => device.user_id === alarm.user_id)
      .map(device =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          JSON.stringify({ title: alarm.title, body: alarm.body, type: 'rest_over', url: '/m/workouts/live', at: alarm.fire_at }),
          { TTL: REST_TTL_SECONDS, urgency: 'high', timeout: SEND_TIMEOUT_MS }
        )
      )
  )
  const outcomes = await Promise.allSettled(deliveries)
  return outcomes.filter(outcome => outcome.status === 'fulfilled').length
}

/**
 * Sends the notifications nobody's phone has received yet, and any rest timer
 * that has run out. The database calls this on every new notification, every
 * five minutes as a backstop, and within seconds of a rest alarm falling due;
 * each run claims its rows, so overlapping runs never deliver anything twice.
 */
Deno.serve(async (request: Request) => {
  if (!authorised(request)) return json({ error: 'Not permitted' }, { status: 403 })
  if (!configure()) return json({ error: 'Push is not configured' }, { status: 500 })

  const admin = serviceClient()
  const rested = await sendRestAlarms(admin)
  const { data: claimed } = await admin.rpc('claim_pushes', { p_limit: BATCH })
  const queue = (claimed ?? []) as QueuedAlert[]
  if (queue.length === 0) return json({ sent: 0, handled: 0, rested })

  const recipients = [...new Set(queue.map(alert => alert.user_id))]
  const [{ data: subscriptions }, { data: people }] = await Promise.all([
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', recipients),
    admin.from('profiles').select('id, role').in('id', recipients),
  ])
  const roleOf = new Map((people ?? []).map(person => [person.id as string, person.role as string]))

  const devicesByUser = new Map<string, Device[]>()
  for (const device of (subscriptions ?? []) as Device[]) {
    devicesByUser.set(device.user_id, [...(devicesByUser.get(device.user_id) ?? []), device])
  }

  const expired = new Set<string>()
  const handled: string[] = []
  let sent = 0

  for (const alert of queue) {
    const devices = devicesByUser.get(alert.user_id) ?? []
    const payload = JSON.stringify({
      title: alert.title,
      body: alert.message,
      type: alert.type,
      url: alertRoute(alert.type, roleOf.get(alert.user_id) ?? null),
      at: alert.created_at,
    })

    const outcomes = await Promise.allSettled(
      devices.map(device =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: FOUR_WEEKS, urgency: URGENT.has(alert.type) ? 'high' : 'normal', timeout: SEND_TIMEOUT_MS }
        )
      )
    )

    let accepted = false
    let retryable = false
    outcomes.forEach((outcome, index) => {
      if (outcome.status === 'fulfilled') {
        accepted = true
        sent += 1
        return
      }
      const status = (outcome.reason as { statusCode?: number })?.statusCode
      if (status === 404 || status === 410) expired.add(devices[index].id)
      else retryable = true
    })

    // With no device left to try the alert still lives in the in-app inbox.
    // A push service that failed for every device gets the row back after the
    // claim expires.
    if (accepted || !retryable) handled.push(alert.id)
  }

  if (handled.length > 0) {
    await admin.from('notifications').update({ pushed_at: new Date().toISOString() }).in('id', handled)
  }
  if (expired.size > 0) {
    await admin.from('push_subscriptions').delete().in('id', [...expired])
  }

  return json({ sent, handled: handled.length, pruned: expired.size, rested })
})
