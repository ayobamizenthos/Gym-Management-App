import { Buffer } from 'node:buffer'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { settleCardPayment } from '../_shared/card-settlement.ts'
import { json } from '../_shared/http.ts'

/**
 * Paystack's server-to-server confirmation. It still credits the member when
 * the browser closed before the callback could run.
 */
Deno.serve(async (request: Request) => {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return json({ error: 'Payments are not configured' }, { status: 500 })

  const raw = await request.text()
  const signature = Buffer.from(request.headers.get('x-paystack-signature') ?? '', 'hex')
  const expected = createHmac('sha512', secret).update(raw).digest()
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) {
    return json({ error: 'Bad signature' }, { status: 401 })
  }

  const event = JSON.parse(raw) as { event?: string; data?: { reference?: string } }
  if (event.event === 'charge.success' && event.data?.reference) {
    await settleCardPayment(event.data.reference)
  }
  return json({ received: true })
})
