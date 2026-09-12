'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { Accordion } from '@/components/Accordion'
import { Dialog } from '@/components/Dialog'
import { naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Plan } from '@/lib/types'

const EMPTY_DRAFT = {
  name: '',
  price: '',
  duration_days: '',
  counts_for_referral: false,
  is_addon: false,
  requires_registration: true,
}

export default function AdminPlans() {
  const push = useToasts(s => s.push)
  const [plans, setPlans] = useState<Plan[]>([])
  const [draft, setDraft] = useState(EMPTY_DRAFT)
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [removing, setRemoving] = useState<Plan | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order')
    setPlans((data ?? []) as Plan[])
    setReady(true)
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = async (id: string, changes: Partial<Plan>) => {
    setPlans(prev => prev.map(p => (p.id === id ? { ...p, ...changes } as Plan : p)))
    const { error } = await supabase.from('plans').update(changes).eq('id', id)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      await load()
      return
    }
    dropMemberCache()
  }

  const add = async () => {
    if (!draft.name.trim()) return
    setBusy(true)
    const { error } = await supabase.from('plans').insert({
      name: draft.name.trim(),
      price: Number(draft.price) || 0,
      duration_days: Number(draft.duration_days) || 0,
      counts_for_referral: draft.counts_for_referral,
      is_addon: draft.is_addon,
      requires_registration: draft.requires_registration,
      sort_order: plans.length + 1,
    })
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Could not add', message: error.message })
      return
    }
    setDraft(EMPTY_DRAFT)
    dropMemberCache()
    push({ tone: 'good', title: 'Plan added' })
    await load()
  }

  const remove = async (plan: Plan) => {
    // A plan referenced by past payments can't be deleted - retire it instead so
    // the payment history keeps its name.
    const { error } = await supabase.from('plans').delete().eq('id', plan.id)
    if (error) {
      await patch(plan.id, { is_active: false })
      push({ tone: 'info', title: 'Plan retired', message: 'It has payments against it, so the record stays.' })
    } else {
      push({ tone: 'good', title: 'Plan removed' })
    }
    dropMemberCache()
    await load()
  }

  return (
    <div className="max-w-4xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Plans &amp; pricing</h1>

      {!ready ? (
        <div className="mt-5 space-y-2" aria-busy="true" aria-label="Loading plans">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-sm bg-base-panel" />
          ))}
        </div>
      ) : (
        <div className="mt-5">
          {plans.map(plan => (
            <div key={plan.id} className={cn('transition-opacity', !plan.is_active && 'opacity-50')}>
              <Accordion title={plan.name} count={naira(plan.price)}>
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-mute">Price</span>
                    <input
                      type="number" min="0" inputMode="numeric" defaultValue={Number(plan.price)}
                      onBlur={e => Number(e.target.value) !== Number(plan.price) && patch(plan.id, { price: e.target.value as unknown as string })}
                      className="field mt-1 h-11"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[10px] uppercase tracking-[0.2em] text-mute">Days</span>
                    <input
                      type="number" min="0" inputMode="numeric" defaultValue={plan.duration_days}
                      onBlur={e => Number(e.target.value) !== plan.duration_days && patch(plan.id, { duration_days: Number(e.target.value) })}
                      className="field mt-1 h-11"
                    />
                  </label>
                  <button
                    onClick={() => setRemoving(plan)}
                    aria-label={'Remove ' + plan.name}
                    className="grid h-11 w-11 place-items-center rounded-sm text-mute transition-colors hover:bg-out-tint hover:text-out"
                  >
                    <Trash2 size={17} aria-hidden />
                  </button>
                </div>
                <label className="mt-3 block">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-mute">Name</span>
                  <input
                    defaultValue={plan.name}
                    onBlur={e => e.target.value.trim() && e.target.value !== plan.name && patch(plan.id, { name: e.target.value.trim() })}
                    className="field mt-1 h-11"
                  />
                </label>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2.5 text-xs">
                  <Toggle on={plan.is_active} onClick={() => patch(plan.id, { is_active: !plan.is_active })} label="Active" />
                  <Toggle on={plan.counts_for_referral} onClick={() => patch(plan.id, { counts_for_referral: !plan.counts_for_referral })} label="Counts for referrals" />
                  <Toggle on={plan.is_addon} onClick={() => patch(plan.id, { is_addon: !plan.is_addon })} label="Add-on (no days)" />
                  <Toggle on={plan.requires_registration} onClick={() => patch(plan.id, { requires_registration: !plan.requires_registration })} label="Charges registration fee" />
                </div>
              </Accordion>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Accordion title="Add a plan">
          <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr]">
            <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="field" />
            <input placeholder="Price" type="number" min="0" inputMode="numeric" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} className="field" />
            <input placeholder="Days" type="number" min="0" inputMode="numeric" value={draft.duration_days} onChange={e => setDraft({ ...draft, duration_days: e.target.value })} className="field" />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2.5 text-xs">
            <Toggle on={draft.counts_for_referral} onClick={() => setDraft({ ...draft, counts_for_referral: !draft.counts_for_referral })} label="Counts for referrals" />
            <Toggle on={draft.is_addon} onClick={() => setDraft({ ...draft, is_addon: !draft.is_addon })} label="Add-on" />
            <Toggle on={draft.requires_registration} onClick={() => setDraft({ ...draft, requires_registration: !draft.requires_registration })} label="Charges registration fee" />
          </div>
          <button onClick={add} disabled={busy || !draft.name.trim()} className="btn-primary mt-4 w-full sm:w-auto sm:px-8">
            {busy ? <span className="dots">Adding</span> : <><Plus size={17} aria-hidden /> Add plan</>}
          </button>
        </Accordion>
      </div>

      {removing && (
        <Dialog
          title={'Remove ' + removing.name + '?'}
          body="Members will no longer see it. Past payments keep their record."
          confirmLabel="Remove"
          tone="danger"
          onConfirm={() => remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  )
}

/** Plans are cached on member devices - a price change has to invalidate them. */
function dropMemberCache() {
  try {
    localStorage.removeItem('zg:plans')
  } catch {}
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className="-my-2 flex min-h-[40px] items-center gap-2 py-2 uppercase tracking-wide text-mute transition-colors hover:text-chalk"
    >
      <span className={cn('relative h-4 w-8 rounded-full transition-colors', on ? 'bg-live' : 'bg-edge')}>
        <span className={cn('absolute top-0.5 h-3 w-3 rounded-full bg-chalk transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}
