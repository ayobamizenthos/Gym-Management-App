'use client'

import { useCallback, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { FileText, Check, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { Dialog } from '@/components/Dialog'
import { playPaid } from '@/lib/sounds'
import { naira, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment } from '@/lib/types'

const PROOF_MAX_PX = 1600

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
  const [proof, setProof] = useState<{ url: string; isPdf: boolean } | null>(null)
  const [rejecting, setRejecting] = useState<Row | null>(null)

  const load = useCallback(async () => {
    let query = supabase
      .from('payments')
      .select('*, plan:plan_id(name), member:user_id(full_name, phone)')
      .eq('status', tab)
    // an open card checkout is not money to confirm; Paystack settles it
    if (tab === 'pending') query = query.neq('method', 'paystack')
    const { data } = await query.order('created_at', { ascending: false }).limit(100)
    setRows((data ?? []) as unknown as Row[])
    setReady(true)
  }, [tab])

  useEffect(() => { setReady(false); void load() }, [load])

  useEffect(() => {
    // confirming a checkout touches several rows; reload once per burst
    let pending: number | undefined
    const reloadSoon = () => {
      window.clearTimeout(pending)
      pending = window.setTimeout(() => void load(), 300)
    }
    const channel = supabase
      .channel('desk-payments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, reloadSoon)
      .subscribe()
    return () => {
      window.clearTimeout(pending)
      void supabase.removeChannel(channel)
    }
  }, [load])

  useEffect(() => {
    if (!proof) return
    const close = (e: KeyboardEvent) => e.key === 'Escape' && setProof(null)
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [proof])

  const openProof = async (path: string) => {
    const { data, error } = await supabase.storage.from('proofs').createSignedUrl(path, 300)
    if (error || !data?.signedUrl) {
      push({ tone: 'bad', title: 'Could not open proof', message: 'The file may have been removed.' })
      return
    }
    setProof({ url: data.signedUrl, isPdf: path.toLowerCase().endsWith('.pdf') })
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
      <h1 className="text-3xl lg:text-4xl">Payments</h1>

      <div className="mt-5 flex gap-5 border-b border-edge-soft" role="tablist" aria-label="Payment status">
        {(['pending', 'confirmed'] as const).map(t => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
            className={cn('capitalize', tab === t ? 'seg-on' : 'seg-off')}>
            {t}
          </button>
        ))}
      </div>

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
            <li key={row.id} className="rounded-lg bg-base-panel p-4">
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
                      className="btn h-10 rounded-md bg-out-tint px-4 text-sm text-out hover:brightness-125">
                      <X size={16} aria-hidden /> Reject
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {proof && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Proof of payment"
          className="fixed inset-0 z-[95] flex flex-col items-center justify-center gap-4 bg-base/90 p-5"
          onClick={() => setProof(null)}
        >
          {proof.isPdf ? (
            <a href={proof.url} target="_blank" rel="noreferrer" className="btn-primary h-12 px-6">
              <FileText size={18} aria-hidden /> Open the PDF receipt
            </a>
          ) : (
            <Image
              src={proof.url}
              alt="Proof of payment"
              width={PROOF_MAX_PX}
              height={PROOF_MAX_PX}
              unoptimized
              className="h-auto max-h-[80dvh] w-auto max-w-full object-contain"
            />
          )}
          <button onClick={() => setProof(null)} className="btn-quiet h-11 px-5 text-sm">Close</button>
        </div>,
        document.body
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
