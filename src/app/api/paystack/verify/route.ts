import { NextResponse } from 'next/server'
import { callerProfile } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'
import { settleCardPayment } from '@/lib/card-settlement'

export const dynamic = 'force-dynamic'

/** Called by the member's browser the moment Paystack reports the charge. */
export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await readJson<{ reference?: string }>(request)
  if (!body?.reference) return NextResponse.json({ error: 'Missing reference' }, { status: 400 })

  const settlement = await settleCardPayment(body.reference, caller.id)
  if (!settlement.ok) return NextResponse.json({ error: settlement.error }, { status: settlement.status })
  return NextResponse.json({ ok: true })
}
