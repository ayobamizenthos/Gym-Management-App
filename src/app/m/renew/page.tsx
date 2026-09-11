'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Upload } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Plan, Settings } from '@/lib/types'

export default function RenewPage() {
  const { profile, refresh } = useAuth()
  const router = useRouter()
  const push = useToasts(s => s.push)

  const [plans, setPlans] = useState<Plan[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(true)
  const [planId, setPlanId] = useState<string | null>(null)
  const [addOns, setAddOns] = useState<string[]>([])
  const [proof, setProof] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    void Promise.all([
      supabase.from('plans').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('settings').select('*').maybeSingle(),
    ]).then(([p, s]) => {
      setPlans((p.data ?? []) as Plan[])
      setSettings(s.data as Settings)
      setLoading(false)
    })
  }, [])

  const memberships = plans.filter(p => !p.is_addon)
  const extras = plans.filter(p => p.is_addon)
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

  const toggleAddOn = (id: string) =>
    setAddOns(current => (current.includes(id) ? current.filter(x => x !== id) : [...current, id]))

  const submit = async () => {
    if (!chosen || !profile) return
    setBusy(true)
    try {
      let proofPath: string | null = null
      if (proof) {
        const safe = proof.name.replace(/[^A-Za-z0-9._-]/g, '')
        proofPath = profile.id + '/' + Date.now() + '-' + safe
        const { error } = await supabase.storage.from('proofs').upload(proofPath, proof)
        if (error) throw error
      }
      for (const id of [chosen.id, ...addOns]) {
        const { error } = await supabase.rpc('request_payment', {
          p_plan: id,
          p_method: 'transfer',
          p_reference: null,
          p_proof: proofPath,
          p_branch: profile.branch_id,
        })
        if (error) throw error
      }
      push({ tone: 'good', title: 'Sent for confirmation', message: 'Your time is added once the desk confirms.' })
      await refresh()
      router.push('/m/history')
    } catch (e) {
      push({ tone: 'bad', title: 'Could not send', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-px" aria-busy="true" aria-label="Loading plans">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse bg-ink-soft" />
        ))}
      </div>
    )
  }

  const Row = ({ plan, on, onPick }: { plan: Plan; on: boolean; onPick: () => void }) => (
    <li>
      <button
        type="button"
        aria-pressed={on}
        onClick={onPick}
        className={cn(
          'flex w-full items-center justify-between py-4 text-left transition-colors',
          on ? 'text-volt' : 'text-paper hover:text-volt'
        )}
      >
        <span className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              'grid h-5 w-5 shrink-0 place-items-center border transition-colors',
              on ? 'border-volt bg-volt' : 'border-ink-line'
            )}
          >
            {on && <Check size={13} className="text-ink" strokeWidth={3} />}
          </span>
          <span className="font-display text-2xl uppercase tracking-tightest">{plan.name}</span>
        </span>
        <span className="font-display text-2xl tabular-nums">{naira(plan.price)}</span>
      </button>
    </li>
  )

  return (
    <div className="animate-rise pb-44">
      <h1 className="text-4xl">Renew</h1>

      <fieldset className="mt-7">
        <legend className="text-xs uppercase tracking-[0.28em] text-ink-mute">Membership</legend>
        <ul role="list" className="mt-3 divide-y divide-ink-line border-y border-ink-line">
          {memberships.map(plan => (
            <Row key={plan.id} plan={plan} on={planId === plan.id} onPick={() => setPlanId(plan.id)} />
          ))}
        </ul>
      </fieldset>

      {extras.length > 0 && (
        <fieldset className="mt-8">
          <legend className="text-xs uppercase tracking-[0.28em] text-ink-mute">Add on</legend>
          <ul role="list" className="mt-3 divide-y divide-ink-line border-y border-ink-line">
            {extras.map(extra => (
              <Row
                key={extra.id}
                plan={extra}
                on={addOns.includes(extra.id)}
                onPick={() => toggleAddOn(extra.id)}
              />
            ))}
          </ul>
        </fieldset>
      )}

      {chosen && (
        <div className="mt-8 animate-rise">
          <label htmlFor="proof" className="text-xs uppercase tracking-[0.28em] text-ink-mute">
            Proof of transfer
          </label>
          <div className="mt-3 flex items-center gap-3 border border-ink-line px-4 py-3.5">
            <Upload size={18} className="shrink-0 text-ink-mute" aria-hidden />
            <input
              id="proof"
              type="file"
              accept="image/*,application/pdf"
              onChange={e => setProof(e.target.files?.[0] ?? null)}
              className="min-w-0 flex-1 text-sm text-ink-mute file:mr-3 file:border-0 file:bg-ink-line file:px-3 file:py-1.5 file:text-paper"
            />
          </div>
        </div>
      )}

      {chosen && (
        <div className="fixed inset-x-0 bottom-[68px] z-30 mx-auto max-w-2xl border-t border-ink-line bg-ink px-5 py-4">
          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs uppercase tracking-[0.28em] text-ink-mute">Total</p>
              <p className="font-display text-4xl leading-none tabular-nums text-volt">{naira(total)}</p>
              {joiningFee > 0 && (
                <p className="mt-1 text-xs text-ink-mute">includes {naira(joiningFee)} joining fee</p>
              )}
            </div>
            <button onClick={submit} disabled={busy} className="btn-volt shrink-0 px-7">
              {busy ? 'Sending' : 'I have paid'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
