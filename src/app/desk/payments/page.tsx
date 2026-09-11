'use client'

import { useCallback, useEffect, useState } from 'react'
import { FileText, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { Dialog } from '@/components/Dialog'
import { playPaid } from '@/lib/sounds'
import { naira, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment } from '@/lib/types'

interface Row extends Payment {
  plan: { name: string } | null
  member: { full_name: string | null; phone: string | null } | null
}

export default function DeskPayments() {
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Row[]>([])
  const [tab, setTab] = useState<'pending' | 'confirmed'>('pending')
  const [busy, setBusy] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('payments')
      .select('*, plan:plan_id(name), member:user_id(full_name, phone)')
      .eq('status', tab)
      .order('created_at', { ascending: false })
      .limit(100)
    setRows((data ?? []) as unknown as Row[])
    setReady(true)
  }, [tab])

  useEffect(() => { setReady(false); void load() }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('desk-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => void load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  useEffect(() => {
    if (!proofUrl) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setProofUrl(null)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [proofUrl])

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) {
      push({ tone: 'bad', title: 'Could not open proof', message: 'The file may have been removed.' })
      return
    }
    setProofUrl(data.signedUrl)
  }

  const confirm = async (id: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('confirm_payment', { p_payment: id })
    setBusy(null)
    if (error) {
      push({ tone: 'bad', title: 'Could not confirm', message: error.message })
      return
    }
    playPaid()
    push({ tone: 'good', title: 'Payment confirmed', message: 'Membership days added.' })
    void load()
  }

  const reject = async (id: string, reason: string) => {
    setBusy(id)
    const { error } = await supabase.rpc('reject_payment', { p_payment: id, p_reason: reason })
    setBusy(null)
    if (error) push({ tone: 'bad', title: 'Could not reject', message: error.message })
    else push({ tone: 'info', title: 'Payment rejected', message: 'The member has been told why.' })
    void load()
  }

  return (
    <div>
      <h1 className="text-4xl md:text-5xl">Payments</h1>

      <div className="mt-5 flex gap-2" role="tablist" aria-label="Payment status">
        {(['pending', 'confirmed'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('h-10 rounded-sm px-5 text-sm font-semibold uppercase tracking-wide transition-colors',
              tab === t ? 'bg-live text-ink' : 'border border-edge text-mute hover:text-chalk')}>
            {t}
          </button>
        ))}
      </div>

      <div className="rule mt-5" />

      {!ready ? (
        <div className="mt-5 space-y-2" aria-busy="true" aria-label="Loading payments">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-32 animate-pulse rounded-sm bg-base-panel" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-20 text-center text-mute">
          {tab === 'pending' ? 'No transfers waiting on you.' : 'No confirmed payments yet.'}
        </p>
      ) : (
        <ul role="list" className="mt-5 flex flex-col gap-2">
          {rows.map(row => (
            <li key={row.id} className="rounded-sm border-l-2 border-edge bg-base-panel p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{row.member?.full_name ?? 'Member'}</p>
                  <p className="text-sm text-mute">
                    {row.member?.phone ?? 'No phone'} · {row.plan?.name ?? 'Payment'} · {shortDate(row.created_at)}
                  </p>
                  {row.includes_registration && (
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-due">Includes joining fee</p>
                  )}
                </div>
                <p className="font-display text-3xl tabular-nums text-live">{naira(row.amount)}</p>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {row.proof_url && (
                  <button onClick={() => void openProof(row.proof_url!)} className="btn-quiet h-10 px-4 text-sm">
                    <FileText size={16} aria-hidden /> View proof
                  </button>
                )}
                {row.status === 'pending' && (
                  <>
                    <button disabled={busy === row.id} onClick={() => void confirm(row.id)} className="btn-primary h-10 px-4 text-sm">
                      {busy === row.id ? <span className="dots">Processing</span> : <><Check size={16} aria-hidden /> Confirm</>}
                    </button>
                    <button disabled={busy === row.id} onClick={() => setRejecting(row)}
                      className="btn h-10 rounded-sm border border-out px-4 text-sm text-out hover:bg-out-tint">
                      <X size={16} aria-hidden /> Reject
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {proofUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Proof of payment"
          className="fixed inset-0 z-[80] grid place-items-center bg-base/90 p-5"
          onClick={() => setProofUrl(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={proofUrl} alt="Proof of payment" className="max-h-[85vh] max-w-full object-contain" />
          <button onClick={() => setProofUrl(null)} className="btn-quiet mt-4 h-10 px-5 text-sm">Close</button>
        </div>
      )}

      {rejecting && (
        <Dialog
          title="Reject this payment?"
          body={(rejecting.member?.full_name ?? 'The member') + ' will see the reason you give.'}
          ask="Reason"
          confirmLabel="Reject"
          tone="danger"
          onConfirm={reason => reject(rejecting.id, reason)}
          onClose={() => setRejecting(null)}
        />
      )}
    </div>
  )
}
