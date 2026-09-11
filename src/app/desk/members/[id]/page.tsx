'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Banknote } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { playPaid } from '@/lib/sounds'
import { daysLeft, naira, shortDate, timeOnly } from '@/lib/format'
import { cn } from '@/lib/cn'
import { Loader } from '@/components/Loader'
import type { Plan, Profile, CheckInRow } from '@/lib/types'

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const push = useToasts(s => s.push)
  const [member, setMember] = useState<Profile | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [visits, setVisits] = useState<CheckInRow[]>([])
  const [planId, setPlanId] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const [m, v] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase.from('check_ins').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(10),
    ])
    setMember(m.data as Profile)
    setVisits((v.data ?? []) as CheckInRow[])
  }, [id])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void supabase.from('plans').select('*').eq('is_active', true).order('sort_order')
      .then(({ data }) => {
        const list = (data ?? []) as Plan[]
        setPlans(list)
        setPlanId(list.find(p => !p.is_addon)?.id ?? '')
      })
  }, [])

  const take = async () => {
    setBusy(true)
    const { error } = await supabase.rpc('record_payment', {
      p_user: id,
      p_plan: planId,
      p_method: method,
      p_reference: null,
      p_auto_confirm: method === 'cash',
    })
    if (error) push({ tone: 'bad', title: 'Could not record', message: error.message })
    else {
      if (method === 'cash') playPaid()
      push({
        tone: 'good',
        title: method === 'cash' ? 'Payment recorded' : 'Logged as pending',
        message: method === 'cash' ? 'Days added immediately.' : 'Confirm it once the transfer lands.',
      })
      await load()
    }
    setBusy(false)
  }

  if (!member) return <Loader />

  const left = daysLeft(member.expires_at)
  const active = left !== null && left > 0
  const chosen = plans.find(p => p.id === planId)

  return (
    <div className="max-w-3xl animate-rise">
      <button onClick={() => router.back()} className="flex items-center gap-2 text-sm text-mute hover:text-ink">
        <ArrowLeft size={16} /> Members
      </button>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl">{member.full_name ?? 'Member'}</h1>
          <p className="mt-1 text-sm text-mute">
            {member.phone ?? 'No phone on file'}
          </p>
        </div>
        <div className="text-right">
          {member.expires_at ? (
            <>
              <p className={cn('font-display text-5xl tabular-nums', active ? 'text-good' : 'text-alert')}>{left}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-mute">
                {active ? 'days left · to ' + shortDate(member.expires_at) : 'expired ' + shortDate(member.expires_at)}
              </p>
            </>
          ) : (
            <p className="text-sm uppercase tracking-[0.2em] text-mute">No plan yet</p>
          )}
        </div>
      </header>

      <div className="rule mt-6" />

      <section className="mt-6">
        <h2 className="flex items-center gap-2 text-2xl"><Banknote size={20} className="text-good" /> Take payment</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <select value={planId} onChange={e => setPlanId(e.target.value)} className="field">
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name} — {naira(p.price)}</option>
            ))}
          </select>
          <select value={method} onChange={e => setMethod(e.target.value as 'cash' | 'transfer')} className="field sm:w-40">
            <option value="cash">Cash</option>
            <option value="transfer">Transfer</option>
          </select>
          <button onClick={take} disabled={busy || !planId} className="btn-primary sm:px-8">
            {busy ? 'Saving' : 'Record'}
          </button>
        </div>
        {chosen && !member.registration_paid && !chosen.is_addon && (
          <p className="mt-2 text-xs text-warn">
            Registration fee will be added — this is their first membership payment.
          </p>
        )}
        {method === 'transfer' && (
          <p className="mt-2 text-xs text-mute">
            Transfers stay pending until confirmed on the Payments screen.
          </p>
        )}
      </section>

      <div className="rule mt-8" />

      <section className="mt-6">
        <h2 className="text-2xl">Recent visits</h2>
        {visits.length === 0 ? (
          <p className="mt-3 text-sm text-mute">No check-ins recorded.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-1.5">
            {visits.map(v => (
              <li key={v.id} className="flex items-center justify-between border-l-2 border-line bg-surface-raised px-4 py-2.5 text-sm">
                <span>{shortDate(v.created_at)}</span>
                <span className="flex items-center gap-3">
                  <span className="tabular-nums text-mute">{timeOnly(v.created_at)}</span>
                  <span className={cn('text-xs font-semibold uppercase tracking-wide',
                    v.kind === 'valid' ? 'text-good' : v.kind === 'expired' ? 'text-alert' : 'text-mute')}>
                    {v.kind.replace('_', ' ')}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
