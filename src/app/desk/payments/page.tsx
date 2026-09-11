'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { playPaid } from '@/lib/sounds'
import { naira, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment } from '@/lib/types'

interface Row extends Payment {
  plan: { name: string } | null
  member: { full_name: string | null; member_code: string | null } | null
}

export default function DeskPayments() {
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'confirmed'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [proofUrl, setProofUrl] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, plan:plan_id(name), member:user_id(full_name, member_code)')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(100)
    setRows((data ?? []) as unknown as Row[])
  }, [tab])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('desk-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const openProof = async (path: string) => {
    const { data } = await supabase.storage.from('proofs').createSignedUrl(path, 300)
    if (data?.signedUrl) setProofUrl(data.signedUrl)
  }

  const confirm = async (id: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('confirm_payment', { p_payment: id })
    if (error) push({ tone: 'bad', title: 'Could not confirm', message: error.message })
    else { playPaid(); push({ tone: 'good', title: 'Payment confirmed', message: 'Membership days added.' }) }
    setBusy(null)
    void load()
  }

  const reject = async (id: string) => {
    const reason = window.prompt('Reason for rejecting this payment?') ?? undefined
    setBusy(id)
    const { error } = await supabase.rpc('reject_payment', { p_payment: id, p_reason: reason })
    if (error) push({ tone: 'bad', title: 'Could not reject', message: error.message })
    else push({ tone: 'info', title: 'Payment rejected' })
    setBusy(null)
    void load()
  }

  return (
    <div>
      <h1 className="text-4xl md:text-5xl">Payments</h1>

      <div className="mt-5 flex gap-2">
        {(['pending', 'confirmed'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={cn('h-10 px-5 text-sm font-semibold uppercase tracking-wide transition-colors',
              tab === t ? 'bg-volt text-ink' : 'border border-ink-line text-ink-mute hover:text-paper')}>
            {t}
          </button>
        ))}
      </div>

      <div className="rule mt-5" />

      {rows.length === 0 ? (
        <p className="py-20 text-center text-ink-mute">Nothing {tab} right now.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-2">
          {rows.map(row => (
            <li key={row.id} className="border-l-2 border-ink-line bg-ink-soft p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{row.member?.full_name ?? 'Member'}</p>
                  <p className="text-sm text-ink-mute">
                    {row.member?.member_code} · {row.plan?.name ?? 'Payment'} · {shortDate(row.created_at)}
                  </p>
                  {row.includes_registration && (
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-warn">Includes registration</p>
                  )}
                </div>
                <p className="font-display text-3xl tabular-nums text-volt">{naira(row.amount)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {row.proof_url && (
                  <button onClick={() => void openProof(row.proof_url!)} className="btn-ghost h-10 px-4 text-sm">
                    <FileText size={16} /> View proof
                  </button>
                )}
                {row.status === 'pending' && (
                  <>
                    <button disabled={busy === row.id} onClick={() => void confirm(row.id)} className="btn-volt h-10 px-4 text-sm">
                      <Check size={16} /> Confirm
                    </button>
                    <button disabled={busy === row.id} onClick={() => void reject(row.id)}
                      className="btn h-10 border border-alert px-4 text-sm text-alert">
                      <X size={16} /> Reject
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {proofUrl && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/95 p-5" onClick={() => setProofUrl(null)}>
          <img src={proofUrl} alt="Proof of payment" className="max-h-[85vh] max-w-full object-contain" />
        </div>
      )}
    </div>
  )
}
