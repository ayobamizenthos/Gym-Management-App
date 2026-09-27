import { serviceClient } from './supabase.ts'

export type Settlement =
  | { ok: true }
  | { ok: false; status: number; error: string }

interface PaystackCharge {
  status?: string
  amount?: number
  currency?: string
  customer?: { email?: string }
  metadata?: { payment_ids?: unknown }
}

const refuse = (status: number, error: string): Settlement => ({ ok: false, status, error })

/**
 * Settles a card checkout from Paystack's own record of the charge. Both the
 * browser callback and the webhook land here, so whichever arrives second
 * finds the reference already settled and changes nothing.
 */
export async function settleCardPayment(reference: string, expectedMember?: string): Promise<Settlement> {
  const secret = Deno.env.get('PAYSTACK_SECRET_KEY')
  if (!secret) return refuse(500, 'Payments are not configured')

  const verification = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), {
    headers: { Authorization: 'Bearer ' + secret },
  })
  const payload = (await verification.json()) as { status?: boolean; data?: PaystackCharge }
  const charge = payload.data
  if (!payload.status || charge?.status !== 'success') return refuse(402, 'Payment was not successful')
  if (charge.currency !== 'NGN') return refuse(402, 'Payment was not in naira')

  const paymentIds = Array.isArray(charge.metadata?.payment_ids)
    ? charge.metadata.payment_ids.filter((id): id is string => typeof id === 'string')
    : []
  if (paymentIds.length === 0) return refuse(400, 'Payment is not linked to a checkout')

  const admin = serviceClient()
  const { data: existing } = await admin.from('paystack_settlements').select('reference').eq('reference', reference).maybeSingle()
  if (existing) return { ok: true }

  const { data: rows } = await admin
    .from('payments')
    .select('id, user_id, amount, status, method')
    .in('id', paymentIds)
  if (!rows || rows.length !== paymentIds.length) return refuse(404, 'Payment not found')

  // A checkout withdrawn when the card window closed is still payable: the
  // close and the charge can race, and the charge is what counts.
  const member = rows[0].user_id
  if (rows.some(row => row.user_id !== member || row.method !== 'paystack' || row.status === 'confirmed')) {
    return refuse(409, 'This checkout is already settled')
  }
  if (expectedMember && member !== expectedMember) return refuse(403, 'This payment belongs to someone else')

  const { data: profile } = await admin.from('profiles').select('email').eq('id', member).maybeSingle()
  if (!profile?.email || charge.customer?.email?.toLowerCase() !== profile.email.toLowerCase()) {
    return refuse(403, 'This payment belongs to someone else')
  }

  const expectedKobo = rows.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0)
  if ((charge.amount ?? 0) < expectedKobo) return refuse(402, 'Amount paid does not cover this checkout')

  // The primary key is the lock: one reference settles one checkout, once.
  const { error: claimError } = await admin
    .from('paystack_settlements')
    .insert({ reference, user_id: member, amount: charge.amount })
  if (claimError) return { ok: true }

  for (const row of rows) {
    await admin.from('payments').update({ reference, status: 'pending' }).eq('id', row.id)
    const { error } = await admin.rpc('confirm_payment', { p_payment: row.id })
    if (error) return refuse(500, 'Payment received but not applied. The front desk will finish it.')
  }
  return { ok: true }
}
