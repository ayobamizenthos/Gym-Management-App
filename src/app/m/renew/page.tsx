'use client'

import { useEffect, useState } from 'react'
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
  const [chosen, setChosen] = useState<Plan | null>(null)
  const [busy, setBusy] = useState(false)
  const [proof, setProof] = useState<File | null>(null)

  useEffect(() => {
    void supabase.from('plans').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => setPlans((data ?? []) as Plan[]))
    void supabase.from('settings').select('*').maybeSingle()
      .then(({ data }) => setSettings(data as Settings))
  }, [])

  const regFee =
    !profile?.registration_paid && chosen && !chosen.is_addon
      ? Number(settings?.registration_fee ?? 0)
      : 0
  const total = chosen ? Number(chosen.price) + regFee : 0

  const fileTransfer = async () => {
    if (!chosen || !profile) return
    setBusy(true)
    try {
      let proofPath: string | null = null
      if (proof) {
        const safeName = proof.name.replace(/[^A-Za-z0-9._-]/g, '')
        const path = profile.id + '/' + Date.now() + '-' + safeName
        const { error } = await supabase.storage.from('proofs').upload(path, proof)
        if (error) throw error
        proofPath = path
      }
      const { error: rpcError } = await supabase.rpc('request_payment', {
        p_plan: chosen.id,
        p_method: 'transfer',
        p_reference: null,
        p_proof: proofPath,
        p_branch: profile.branch_id,
      })
      if (rpcError) throw rpcError
      push({ tone: 'good', title: 'Sent to the front desk', message: 'Your days are added once they confirm.' })
      await refresh()
      router.push('/m/history')
    } catch (e) {
      push({ tone: 'bad', title: 'Could not send', message: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="animate-rise">
      <h1 className="text-4xl">Choose a plan</h1>
      <p className="mt-2 text-sm text-ink-mute">
        {profile?.registration_paid
          ? 'Your registration is already paid.'
          : 'First payment includes a one-time ' + naira(settings?.registration_fee ?? 5000) + ' registration fee.'}
      </p>

      <ul className="mt-6 flex flex-col gap-2">
        {plans.map(plan => {
          const on = chosen?.id === plan.id
          return (
            <li key={plan.id}>
              <button
                onClick={() => setChosen(plan)}
                className={cn(
                  'flex w-full items-center justify-between border px-4 py-4 text-left transition-colors',
                  on ? 'border-volt bg-volt/10' : 'border-ink-line hover:border-ink-mute'
                )}
              >
                <span>
                  <span className="block font-display text-2xl uppercase tracking-tightest">{plan.name}</span>
                  <span className="block text-xs uppercase tracking-[0.2em] text-ink-mute">
                    {plan.is_addon ? 'Add-on' : plan.duration_days + ' days'}
                    {plan.counts_for_referral ? ' / counts for referrals' : ''}
                  </span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-display text-2xl tabular-nums">{naira(plan.price)}</span>
                  {on && <Check size={20} className="text-volt" />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {chosen && (
        <section className="mt-8 animate-rise border-t border-ink-line pt-6">
          <div className="flex items-baseline justify-between">
            <span className="text-sm uppercase tracking-[0.2em] text-ink-mute">Total due</span>
            <span className="font-display text-4xl tabular-nums text-volt">{naira(total)}</span>
          </div>
          {regFee > 0 && (
            <p className="mt-1 text-right text-xs text-ink-mute">
              {naira(chosen.price)} plus {naira(regFee)} registration
            </p>
          )}

          <label className="mt-7 block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Proof of transfer</span>
            <div className="mt-2 flex items-center gap-3 border border-dashed border-ink-line px-4 py-4">
              <Upload size={18} className="text-ink-mute" />
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={e => setProof(e.target.files?.[0] ?? null)}
                className="min-w-0 flex-1 text-sm text-ink-mute file:mr-3 file:border-0 file:bg-ink-line file:px-3 file:py-1.5 file:text-paper"
              />
            </div>
          </label>

          <button onClick={fileTransfer} disabled={busy} className="btn-ghost mt-4 w-full">
            {busy ? 'Sending' : 'I have transferred'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-ink-mute">
            The front desk confirms the transfer before your days are added. You are
            notified the moment it clears.
          </p>
        </section>
      )}
    </div>
  )
}
