import { createHmac, timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { settleCardPayment } from '@/lib/card-settlement'

export const dynamic = 'force-dynamic'

/**
 * Paystack's server-to-server confirmation. It still credits the member when
 * the browser closed before the callback could run.
 */
export async function POST(request: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return NextResponse.json({ error: 'Payments are not configured' }, { status: 500 })

  const raw = await request.text()
  const signature = Buffer.from(request.headers.get('x-paystack-signature') ?? '', 'hex')
  const expected = createHmac('sha512', secret).update(raw).digest()
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return NextResponse.json({ error: 'Bad signature' }, { status: 401 })
  }

  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  if (event.event === 'charge.success' && event.data?.reference) {
    await settleCardPayment(event.data.reference)
  }
  return NextResponse.json({ received: true })
}
