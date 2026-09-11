import { NextResponse } from 'next/server'
import { callerProfile, serviceClient } from '@/lib/server-supabase'
import { readJson } from '@/lib/server-http'

export const dynamic = 'force-dynamic'

/**
 * Confirms a card payment. The browser is only trusted to say "this reference
 * happened" - the amount and status are read back from Paystack with the secret
 * key, and must cover the pending rows before any membership time is granted.
 */
export async function POST(request: Request) {
  const caller = await callerProfile(request)
  if (!caller) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const body = await readJson<{
    reference?: string
    payment_ids?: string[]
  }>(request)
  if (!body) return NextResponse.json({ error: 'Malformed request' }, { status: 400 })

  const { reference, payment_ids: paymentIds } = body
  if (!reference || !Array.isArray(paymentIds) || paymentIds.length === 0) {
    return NextResponse.json({ error: 'Missing reference' }, { status: 400 })
  }

  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ error: 'Payments are not configured' }, { status: 500 })

  const admin = serviceClient()

  const { data: rows, error: loadError } = await admin
    .from('payments')
    .select('id, user_id, amount, status')
    .in('id', paymentIds)
  if (loadError || !rows || rows.length !== paymentIds.length) {
    return NextResponse.json({ error: 'Payment not found' }, { status: 404 })
  }
  // A member may only settle their own rows.
  if (rows.some(row => row.user_id !== caller.id)) {
    return NextResponse.json({ error: 'Not permitted' }, { status: 403 })
  }
  if (rows.some(row => row.status !== 'pending')) {
    return NextResponse.json({ error: 'Already settled' }, { status: 409 })
  }

  const verification = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + secret },
  })
  const payload = (await verification.json()) as {
    status?: boolean
    data?: { status?: string; amount?: number; currency?: string }
  }
  if (!payload.status || payload.data?.status !== 'success') {
    return NextResponse.json({ error: 'Payment was not successful' }, { status: 402 })
  }

  const expectedKobo = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0)
  if ((payload.data.amount ?? 0) < expectedKobo) {
    return NextResponse.json({ error: 'Amount paid does not cover this order' }, { status: 402 })
  }

  for (const row of rows) {
    await admin.from('payments').update({ reference, method: 'paystack' }).eq('id', row.id)
    const { error } = await admin.rpc('confirm_payment', { p_payment: row.id })
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
