'use client'

import { useCallback, useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { naira } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Plan } from '@/lib/types'

export default function AdminPlans() {
  const push = useToasts(s => s.push)
  const [plans, setPlans] = useState<Plan[]>([])
  const [draft, setDraft] = useState({ name: '', price: '', duration_days: '', counts_for_referral: false, is_addon: false })
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('plans').select('*').order('sort_order')
    setPlans((data ?? []) as Plan[])
  }, [])
  useEffect(() => { void load() }, [load])

  const patch = async (id: string, changes: Partial<Plan>) => {
    setPlans(prev => prev.map(p => (p.id === id ? { ...p, ...changes } as Plan : p)))
    const { error } = await supabase.from('plans').update(changes).eq('id', id)
    if (error) push({ tone: 'bad', title: 'Not saved', message: error.message })
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
      sort_order: plans.length + 1,
    })
    if (error) push({ tone: 'bad', title: 'Could not add', message: error.message })
    else {
      setDraft({ name: '', price: '', duration_days: '', counts_for_referral: false, is_addon: false })
      await load()
    }
    setBusy(false)
  }

  const remove = async (plan: Plan) => {
    if (!window.confirm('Remove ' + plan.name + '? Past payments keep their record.')) return
    const { error } = await supabase.from('plans').delete().eq('id', plan.id)
    if (error) await patch(plan.id, { is_active: false })
    await load()
  }

  return (
    <div className="max-w-4xl animate-rise">
      <h1 className="text-4xl lg:text-5xl">Plans &amp; pricing</h1>
      <p className="mt-2 text-sm text-ink-mute">Edit prices here. Nothing needs a developer.</p>

      <div className="rule mt-6" />

      <ul className="mt-5 flex flex-col gap-2">
        {plans.map(plan => (
          <li key={plan.id} className={cn('bg-ink-soft p-4 transition-opacity', !plan.is_active && 'opacity-50')}>
            <div className="grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto] sm:items-center">
              <input
                defaultValue={plan.name}
                onBlur={e => e.target.value !== plan.name && patch(plan.id, { name: e.target.value })}
                className="field h-11"
              />
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-mute">Price</span>
                <input
                  type="number" min="0" defaultValue={Number(plan.price)}
                  onBlur={e => patch(plan.id, { price: e.target.value as unknown as string })}
                  className="field h-11"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-mute">Days</span>
                <input
                  type="number" min="0" defaultValue={plan.duration_days}
                  onBlur={e => patch(plan.id, { duration_days: Number(e.target.value) })}
                  className="field h-11"
                />
              </label>
              <button onClick={() => remove(plan)} aria-label="Remove" className="grid h-11 w-11 place-items-center text-ink-mute hover:text-alert">
                <Trash2 size={17} />
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <Toggle on={plan.is_active} onClick={() => patch(plan.id, { is_active: !plan.is_active })} label="Active" />
              <Toggle on={plan.counts_for_referral} onClick={() => patch(plan.id, { counts_for_referral: !plan.counts_for_referral })} label="Counts for referrals" />
              <Toggle on={plan.is_addon} onClick={() => patch(plan.id, { is_addon: !plan.is_addon })} label="Add-on (no days)" />
              <span className="ml-auto self-center font-display text-lg tabular-nums text-volt">{naira(plan.price)}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="rule mt-8" />

      <section className="mt-6">
        <h2 className="text-2xl">Add a plan</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1.4fr_1fr_1fr_auto]">
          <input placeholder="Name" value={draft.name} onChange={e => setDraft({ ...draft, name: e.target.value })} className="field" />
          <input placeholder="Price" type="number" value={draft.price} onChange={e => setDraft({ ...draft, price: e.target.value })} className="field" />
          <input placeholder="Days" type="number" value={draft.duration_days} onChange={e => setDraft({ ...draft, duration_days: e.target.value })} className="field" />
          <button onClick={add} disabled={busy} className="btn-volt px-6"><Plus size={17} /> Add</button>
        </div>
        <div className="mt-3 flex gap-4 text-xs">
          <Toggle on={draft.counts_for_referral} onClick={() => setDraft({ ...draft, counts_for_referral: !draft.counts_for_referral })} label="Counts for referrals" />
          <Toggle on={draft.is_addon} onClick={() => setDraft({ ...draft, is_addon: !draft.is_addon })} label="Add-on" />
        </div>
      </section>
    </div>
  )
}

function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} className="flex items-center gap-2 uppercase tracking-wide text-ink-mute hover:text-paper">
      <span className={cn('relative h-4 w-8 transition-colors', on ? 'bg-volt' : 'bg-ink-line')}>
        <span className={cn('absolute top-0.5 h-3 w-3 bg-ink transition-all', on ? 'left-[18px]' : 'left-0.5')} />
      </span>
      {label}
    </button>
  )
}
