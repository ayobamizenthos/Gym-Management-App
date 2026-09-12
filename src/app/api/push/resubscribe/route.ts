import { NextResponse } from 'next/server'
import { serviceClient } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

interface Body {
  old?: string
  fresh?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
}

/**
 * Browsers rotate push subscriptions without warning, and the service worker
 * that notices has no session to prove who it belongs to. The old endpoint is
 * the proof: only the device holding it could know it, so the row it already
 * owns is moved onto the new endpoint. A request that does not match an
 * existing row changes nothing.
 */
export async function POST(request: Request) {
  const body = await readJson<Body>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const { old, fresh } = body
  if (!old || !fresh?.endpoint || !fresh.keys?.p256dh || !fresh.keys.auth) {
    return NextResponse.json({ error: 'Nothing to move' }, { status: 400 })
  }

  const admin = serviceClient()
  const { data: existing } = await admin
    .from('push_subscriptions')
    .select('id')
    .eq('endpoint', old)
    .maybeSingle()

  if (!existing) return NextResponse.json({ moved: false })

  await admin
    .from('push_subscriptions')
    .update({
      endpoint: fresh.endpoint,
      p256dh: fresh.keys.p256dh,
      auth: fresh.keys.auth,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  return NextResponse.json({ moved: true })
}
