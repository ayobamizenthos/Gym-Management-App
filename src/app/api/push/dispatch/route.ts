import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { serviceClient } from '@/lib/server-supabase'
import { kindOf } from '@/lib/notifications'
import type { Role } from '@/lib/types'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT
  if (!publicKey || !privateKey || !subject) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

function authorised(request: Request) {
  const secret = process.env.PUSH_DISPATCH_SECRET
  const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? ''
  if (!secret || offered.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(offered), Buffer.from(secret))
}

/**
 * Sends the notifications nobody's phone has received yet. The database calls
 * this on every new notification and every five minutes as a backstop; each
 * run claims its rows, so overlapping runs never deliver the same alert twice.
 */
export async function POST(request: Request) {
  if (!authorised(request)) return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  if (!configure()) return NextResponse.json({ error: 'Push is not configured' }, { status: 500 })

  const admin = serviceClient()
  const { data: claimed } = await admin.rpc('claim_pushes', { p_limit: BATCH })
  const queue = (claimed ?? []) as QueuedAlert[]
  if (queue.length === 0) return NextResponse.json({ sent: 0, handled: 0 })

  const recipients = [...new Set(queue.map(alert => alert.user_id))]
  const [{ data: subscriptions }, { data: people }] = await Promise.all([
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', recipients),
    admin.from('profiles').select('id, role').in('id', recipients),
  ])
  const roleOf = new Map((people ?? []).map(person => [person.id as string, person.role as Role]))

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
      url: kindOf(alert.type).href(roleOf.get(alert.user_id) ?? null),
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

  return NextResponse.json({ sent, handled: handled.length, pruned: expired.size })
}
