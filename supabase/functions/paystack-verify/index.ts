import { callerProfile } from '../_shared/supabase.ts'
import { json, readJson } from '../_shared/http.ts'
import { settleCardPayment } from '../_shared/card-settlement.ts'

/** Called by the member's browser the moment Paystack reports the charge. */
Deno.serve(async (request: Request) => {
  const caller = await callerProfile(request)
  if (!caller) return json({ error: 'Not authenticated' }, { status: 401 })

  const body = await readJson<{ reference?: string }>(request)
  if (!body?.reference) return json({ error: 'Missing reference' }, { status: 400 })

  const settlement = await settleCardPayment(body.reference, caller.id)
  if (!settlement.ok) return json({ error: settlement.error }, { status: settlement.status })
  return json({ ok: true })
})
