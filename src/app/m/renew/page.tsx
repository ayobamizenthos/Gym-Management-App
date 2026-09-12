'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Upload, CreditCard, Landmark, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import { useCached } from '@/hooks/useCached'
import { isReachableEmail } from '@/lib/members'
import type { Plan, Settings } from '@/lib/types'

type Method = 'card' | 'transfer'

interface PaystackHandler {
  openIframe: () => void
}

declare global {
  interface Window {
    PaystackPop?: { setup: (options: Record<string, unknown>) => PaystackHandler }
  }
}

function PlanRow({ plan, on, onPick }: { plan: Plan; on: boolean; onPick: () => void }) {
  return (
    <li>
      <button
        type="button"
        aria-pressed={on}
        onClick={onPick}
        className={cn(
          'flex w-full items-center justify-between rounded-md px-4 py-3.5 text-left transition-colors',
          on ? 'bg-base-raised' : 'bg-base-panel hover:bg-base-raised'
        )}
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center rounded-full transition-colors',
              on ? 'bg-chalk' : 'bg-edge'
            )}
          >
            {on && <Check size={13} className="text-ink" strokeWidth={3} />}
          </span>
          <span className="font-display text-lg">{plan.name}</span>
        </span>
        <span className="font-display text-lg tabular-nums">{naira(plan.price)}</span>
      </button>
    </li>
  )
}

export default function RenewPage() {
  const { profile, refresh } = useAuth()
  const router = useRouter()
  const push = useToasts(s => s.push)

  const [planId, setPlanId] = useState<string | null>(null)
  const [addOns, setAddOns] = useState<string[]>([])
  const [method, setMethod] = useState<Method>('card')
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  const { data: plans, loading } = useCached<Plan[]>('plans', async () => {
    const { data } = await supabase.from('plans').select('*').eq('is_active', true).order('sort_order')
    return (data ?? []) as Plan[]
  })
  const { data: settings } = useCached<Settings>('settings', async () => {
    const { data } = await supabase.from('settings').select('*').maybeSingle()
    return data as Settings
  })

  useEffect(() => {
    if (document.getElementById('paystack-inline')) return
    const script = document.createElement('script')
    script.id = 'paystack-inline'
    script.src = 'https://js.paystack.co/v1/inline.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  const memberships = (plans ?? []).filter(p => !p.is_addon)
  const extras = (plans ?? []).filter(p => p.is_addon)
  const chosen = memberships.find(p => p.id === planId) ?? null

  const { joiningFee, total } = useMemo(() => {
    const picked = [chosen, ...extras.filter(e => addOns.includes(e.id))].filter(Boolean) as Plan[]
    const base = picked.reduce((sum, p) => sum + Number(p.price), 0)
    const fee =
      chosen && chosen.requires_registration && !profile?.registration_paid
        ? Number(settings?.registration_fee ?? 0)
        : 0
    return { joiningFee: fee, total: base + fee }
  }, [chosen, extras, addOns, profile?.registration_paid, settings])

  const cardAvailable = isReachableEmail(profile?.email)

  useEffect(() => {
    if (!cardAvailable) setMethod('transfer')
  }, [cardAvailable])

  // Tapping the selected plan again clears it.
  const pickPlan = (id: string) => setPlanId(current => (current === id ? null : id))
  const toggleAddOn = (id: string) =>
    setAddOns(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]))

  const createPending = async (proofPath: string | null) => {
    const { data, error } = await supabase.rpc('request_payments', {
      p_plans: [chosen!.id, ...addOns],
      p_method: method === 'card' ? 'paystack' : 'transfer',
      p_proof: proofPath,
      p_branch: profile!.branch_id,
    })
    if (error) throw error
    return (data ?? []) as string[]
  }

  const payByTransfer = async () => {
    let proofPath: string | null = null
    if (proof) {
      const safe = proof.name.replace(/[^A-Za-z0-9._-]/g, '')
      proofPath = profile!.id + '/' + Date.now() + '-' + safe
      const { error } = await supabase.storage.from('proofs').upload(proofPath, proof)
      if (error) throw error
    }
    await createPending(proofPath)
    push({ tone: 'good', title: 'Sent for confirmation', message: 'Your time is added once the desk confirms.' })
    await refresh()
    router.push('/m/history')
  }

  const payByCard = async () => {
    const ids = await createPending(null)
    const key = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY
    if (!window.PaystackPop || !key) throw new Error('Card payment is unavailable right now')
    const reference = 'zg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8)

    window.PaystackPop.setup({
      key,
      email: profile!.email!,
      amount: Math.round(total * 100),
      currency: 'NGN',
      ref: reference,
      onClose: () => {
        setBusy(false)
        push({ tone: 'info', title: 'Payment cancelled' })
      },
      callback: (response: { reference: string }) => {
        void (async () => {
          const { data: session } = await supabase.auth.getSession()
          const res = await fetch('/api/paystack/verify', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: 'Bearer ' + session.session?.access_token,
            },
            body: JSON.stringify({ reference: response.reference, payment_ids: ids }),
          })
          const payload = await res.json()
          setBusy(false)
          if (!res.ok) {
            push({ tone: 'bad', title: 'Could not verify', message: payload.error })
            return
          }
          push({ tone: 'good', title: 'Payment confirmed', message: 'Your membership is active.' })
          await refresh()
          router.push('/m')
        })()
      },
    }).openIframe()
  }

  const submit = async () => {
    if (!chosen || !profile) return
    setBusy(true)
    try {
      if (method === 'transfer') {
        await payByTransfer()
        setBusy(false)
      } else {
        await payByCard()
      }
    } catch (e) {
      setBusy(false)
      push({ tone: 'bad', title: 'Could not continue', message: (e as Error).message })
    }
  }

  if (loading) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading plans">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-md bg-base-panel" />
        ))}
      </div>
    )
  }

  return (
    <div className="animate-rise">
      <h1 className="text-3xl">Renew</h1>

      <fieldset className="mt-6">
        <legend className="text-sm font-semibold text-mute">Membership</legend>
        <ul role="list" className="mt-3 flex flex-col gap-2">
          {memberships.map(plan => (
            <PlanRow key={plan.id} plan={plan} on={planId === plan.id} onPick={() => pickPlan(plan.id)} />
          ))}
        </ul>
      </fieldset>

      {extras.length > 0 && (
        <fieldset className="mt-7">
          <legend className="text-sm font-semibold text-mute">Add on</legend>
          <ul role="list" className="mt-3 flex flex-col gap-2">
            {extras.map(extra => (
              <PlanRow key={extra.id} plan={extra} on={addOns.includes(extra.id)} onPick={() => toggleAddOn(extra.id)} />
            ))}
          </ul>
        </fieldset>
      )}

      {chosen && (
        <div className="mt-7 animate-rise">
          <p className="text-sm font-semibold text-mute">Pay with</p>
          <div className={cn('mt-3 grid gap-2', cardAvailable ? 'grid-cols-2' : 'grid-cols-1')}>
            {cardAvailable && (
              <button
                type="button"
                aria-pressed={method === 'card'}
                onClick={() => setMethod('card')}
                className={cn(
                  'flex h-11 items-center justify-center gap-2 rounded-md text-[15px] font-semibold transition-colors',
                  method === 'card' ? 'bg-chalk text-ink' : 'bg-base-panel text-chalk hover:bg-base-raised'
                )}
              >
                <CreditCard size={17} aria-hidden /> Card
              </button>
            )}
            <button
              type="button"
              aria-pressed={method === 'transfer'}
              onClick={() => setMethod('transfer')}
              className={cn(
                'flex h-11 items-center justify-center gap-2 rounded-md text-[15px] font-semibold transition-colors',
                method === 'transfer' ? 'bg-chalk text-ink' : 'bg-base-panel text-chalk hover:bg-base-raised'
              )}
            >
              <Landmark size={17} aria-hidden /> Transfer
            </button>
          </div>

          {method === 'transfer' && (
            <div className="mt-4 animate-rise">
              <label htmlFor="proof" className="text-sm font-semibold text-mute">
                Proof of transfer
              </label>
              <div className="mt-2 flex items-center gap-3 rounded-md bg-base-panel px-4 py-3">
                <Upload size={17} className="shrink-0 text-mute" aria-hidden />
                {proof ? (
                  <>
                    <span className="min-w-0 flex-1 truncate text-sm text-chalk">{proof.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setProof(null)
                        const field = document.getElementById('proof') as HTMLInputElement | null
                        if (field) field.value = ''
                      }}
                      aria-label="Remove this file"
                      className="-mr-1.5 grid h-8 w-8 shrink-0 place-items-center rounded-full text-mute transition-colors hover:bg-out-tint hover:text-out"
                    >
                      <X size={16} aria-hidden />
                    </button>
                  </>
                ) : null}
                <input
                  id="proof"
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={e => setProof(e.target.files?.[0] ?? null)}
                  className={cn(
                    'min-w-0 flex-1 text-sm text-mute file:mr-3 file:rounded file:border-0 file:bg-base-raised file:px-3 file:py-1.5 file:text-chalk',
                    proof && 'sr-only'
                  )}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {chosen && (
        <div
          className="sticky z-30 -mx-5 mt-7 bg-base px-5 pb-4 pt-3"
          style={{ bottom: 'calc(68px + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-semibold text-mute">Total</span>
            <span className="font-display text-2xl tabular-nums">{naira(total)}</span>
          </div>
          {joiningFee > 0 && (
            <p className="mt-0.5 text-right text-xs text-mute">includes {naira(joiningFee)} joining fee</p>
          )}
          <button onClick={submit} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? (
              <span className="dots">Processing</span>
            ) : method === 'card' ? (
              'Pay ' + naira(total)
            ) : (
              'I have transferred'
            )}
          </button>
        </div>
      )}
    </div>
  )
}
