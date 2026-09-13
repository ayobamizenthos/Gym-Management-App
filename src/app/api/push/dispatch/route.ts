import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { serviceClient } from '@/lib/server-supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Row {
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

const ROUTES: Record<string, string> = {
  payment_confirmed: '/m/history',
  payment_rejected: '/m/history',
  payment_pending: '/desk/payments',
  member_joined: '/desk/members',
  renewals_due: '/m/renew',
  referral_reward: '/m/referrals',
  referral_joined: '/m/referrals',
  birthday: '/m',
}

function configure() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT || 'mailto:support@zenthosgym.com'
  if (!publicKey || !privateKey) return false
  webpush.setVapidDetails(subject, publicKey, privateKey)
  return true
}

/**
 * Sends every notification that has not been pushed yet.
 *
 * The queue is the notifications table itself: a row with no pushed_at has not
 * reached anyone's phone. That is what makes an offline member work - their
 * device simply is not reachable, the row stays unpushed, and the moment their
 * data comes back the push service delivers what it was holding. Marking the
 * row pushed is what stops them being buried again on the next reconnect.
 *
 * Called by the database whenever a notification is written, and safe to call
 * on a timer as a backstop: it only ever picks up what is still outstanding.
 */
export async function POST(request: Request) {
  const secret = process.env.SUPABASE_SECRET_KEY
  const offered = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
  if (!secret || offered !== secret) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }
  if (!configure()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 500 })
  }

  const admin = serviceClient()

  const { data: pending } = await admin
    .from('notifications')
    .select('id, user_id, type, title, message, created_at')
    .is('pushed_at', null)
    .order('created_at', { ascending: true })
    .limit(200)

  const queue = (pending ?? []) as Row[]
  if (queue.length === 0) return NextResponse.json({ sent: 0, pending: 0 })

  const recipients = [...new Set(queue.map(row => row.user_id))]
  const { data: subscriptions } = await admin
    .from('push_subscriptions')
    .select('id, user_id, endpoint, p256dh, auth')
    .in('user_id', recipients)

  const byUser = new Map<string, Device[]>()
  for (const device of (subscriptions ?? []) as Device[]) {
    const list = byUser.get(device.user_id)
    if (list) list.push(device)
    else byUser.set(device.user_id, [device])
  }

  const dead: string[] = []
  const delivered: string[] = []
  let sent = 0

  for (const row of queue) {
    const devices = byUser.get(row.user_id) ?? []
    // Nobody registered a device: the alert still lives in the in-app inbox, so
    // it is marked handled rather than retried on every run forever.
    if (devices.length === 0) {
      delivered.push(row.id)
      continue
    }

    const payload = JSON.stringify({
      title: row.title,
      body: row.message,
      type: row.type,
      url: ROUTES[row.type] ?? '/m',
      at: row.created_at,
    })

    const results = await Promise.allSettled(
      devices.map(device =>
        webpush.sendNotification(
          { endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } },
          payload,
          { TTL: 60 * 60 * 24, urgency: row.type === 'payment_pending' ? 'high' : 'normal' }
        )
      )
    )

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        sent += 1
        return
      }
      const status = (result.reason as { statusCode?: number })?.statusCode
      // 404 and 410 mean the browser threw this subscription away
      if (status === 404 || status === 410) dead.push(devices[index].id)
    })

    delivered.push(row.id)
  }

  if (delivered.length > 0) {
    await admin
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .in('id', delivered)
  }
  if (dead.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', dead)
  }

  return NextResponse.json({ sent, handled: delivered.length, pruned: dead.length })
}
