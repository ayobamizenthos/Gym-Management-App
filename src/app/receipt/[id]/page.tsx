'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft, Printer } from 'lucide-react'
import { RoleGate } from '@/components/RoleGate'
import { supabase } from '@/lib/supabase'
import { naira } from '@/lib/format'
import { useSettings } from '@/hooks/useSettings'
import type { Payment } from '@/lib/types'

interface ReceiptRow extends Payment {
  plan: { name: string; duration_days: number; price: string } | null
  branch: { name: string; address: string | null } | null
  member: { full_name: string | null; username: string | null; phone: string | null } | null
  staff: { full_name: string | null } | null
}

const METHOD: Record<Payment['method'], string> = { paystack: 'Card (Paystack)', transfer: 'Bank transfer', cash: 'Cash' }
const STATUS: Record<Payment['status'], string> = { confirmed: 'PAID', pending: 'AWAITING DESK', rejected: 'REJECTED' }

// Code 39: each character is nine bars and spaces, three of them wide
const CODE39: Record<string, string> = {
  '0': 'nnnwwnwnn', '1': 'wnnwnnnnw', '2': 'nnwwnnnnw', '3': 'wnwwnnnnn', '4': 'nnnwwnnnw', '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn', '7': 'nnnwnnwnw', '8': 'wnnwnnwnn', '9': 'nnwwnnwnn', A: 'wnnnnwnnw', B: 'nnwnnwnnw',
  C: 'wnwnnwnnn', D: 'nnnnwwnnw', E: 'wnnnwwnnn', F: 'nnwnwwnnn', G: 'nnnnnwwnw', H: 'wnnnnwwnn',
  I: 'nnwnnwwnn', J: 'nnnnwwwnn', K: 'wnnnnnnww', L: 'nnwnnnnww', M: 'wnwnnnnwn', N: 'nnnnwnnww',
  O: 'wnnnwnnwn', P: 'nnwnwnnwn', Q: 'nnnnnnwww', R: 'wnnnnnwwn', S: 'nnwnnnwwn', T: 'nnnnwnwwn',
  U: 'wwnnnnnnw', V: 'nwwnnnnnw', W: 'wwwnnnnnn', X: 'nwnnwnnnw', Y: 'wwnnwnnnn', Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw', '*': 'nwnnwnwnn',
}

function Barcode({ value }: { value: string }) {
  const bars: { x: number; w: number }[] = []
  let x = 0
  for (const char of `*${value}*`) {
    const pattern = CODE39[char] ?? CODE39['-']
    ;[...pattern].forEach((width, index) => {
      const w = width === 'w' ? 3 : 1
      if (index % 2 === 0) bars.push({ x, w })
      x += w
    })
    x += 1
  }
  return (
    <svg viewBox={`0 0 ${x} 40`} preserveAspectRatio="none" className="h-14 w-full" aria-label={`Barcode ${value}`}>
      {bars.map(bar => (
        <rect key={bar.x} x={bar.x} y="0" width={bar.w} height="40" fill="#000" />
      ))}
    </svg>
  )
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="text-right">{value}</span>
    </div>
  )
}

function Receipt() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { settings } = useSettings()
  const [row, setRow] = useState<ReceiptRow | null | undefined>(undefined)

  useEffect(() => {
    void supabase
      .from('payments')
      .select(
        '*, plan:plan_id(name, duration_days, price), branch:branch_id(name, address), member:profiles!payments_user_id_fkey(full_name, username, phone), staff:profiles!payments_confirmed_by_fkey(full_name)'
      )
      .eq('id', id)
      .maybeSingle()
      .then(({ data }) => setRow((data as unknown as ReceiptRow) ?? null))
  }, [id])

  if (row === undefined) return <div className="mx-auto mt-20 h-96 max-w-sm animate-pulse rounded-lg bg-base-panel" aria-busy="true" />
  if (row === null) return <p className="mt-20 text-center text-mute">This receipt is not available.</p>

  const paidAt = new Date(row.confirmed_at ?? row.created_at)
  const number = (row.reference ?? row.id.slice(0, 8)).toUpperCase().replace(/[^0-9A-Z-]/g, '')
  const planPrice = Number(row.plan?.price ?? row.amount)
  const fee = row.includes_registration ? Number(row.amount) - planPrice : 0

  return (
    <main className="mx-auto max-w-sm px-5 pb-12 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="no-print flex items-center justify-between">
        <button type="button" onClick={() => router.back()} aria-label="Back" className="-ml-2 grid h-11 w-11 place-items-center rounded-full active:bg-base-raised">
          <ChevronLeft size={26} aria-hidden />
        </button>
        <button type="button" onClick={() => window.print()} className="flex h-10 items-center gap-2 rounded-full bg-chalk px-4 text-[14px] font-semibold text-inverse">
          <Printer size={16} aria-hidden />
          Print
        </button>
      </div>

      <article className="mt-4 bg-white px-6 py-7 font-mono text-[13px] leading-relaxed text-black shadow-lift print:shadow-none">
        <div className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- prints sharp at any size */}
          <img src="/logo-dark.png" alt="Zenthos" className="h-5 w-auto" />
          <p className="mt-2 font-semibold">{settings.gym_name}</p>
          {row.branch && <p>{row.branch.name} · {row.branch.address}</p>}
        </div>

        <p className="my-4 text-center tracking-[0.3em]">SALES RECEIPT</p>
        <div className="border-t border-dashed border-black pt-3">
          <Line label="Receipt" value={number} />
          <Line label="Date" value={paidAt.toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })} />
          <Line label="Time" value={paidAt.toLocaleTimeString('en-NG', { hour: 'numeric', minute: '2-digit', hour12: true })} />
          <Line label="Member" value={row.member?.full_name ?? '—'} />
          {row.member?.phone && <Line label="Phone" value={row.member.phone} />}
        </div>

        <div className="mt-3 border-t border-dashed border-black pt-3">
          <Line label={`${row.plan?.name ?? 'Membership'}${row.plan?.duration_days ? ` (${row.plan.duration_days} days)` : ''}`} value={naira(planPrice)} />
          {fee > 0 && <Line label="Registration" value={naira(fee)} />}
        </div>

        <div className="mt-3 border-t border-dashed border-black pt-3 text-[15px] font-bold">
          <Line label="TOTAL" value={naira(row.amount)} />
        </div>
        <div className="mt-2">
          <Line label="Paid by" value={METHOD[row.method]} />
          <Line label="Status" value={STATUS[row.status]} />
          {row.staff?.full_name && <Line label="Served by" value={row.staff.full_name} />}
        </div>

        <div className="mt-5">
          <Barcode value={number} />
          <p className="mt-1 text-center tracking-[0.25em]">{number}</p>
        </div>
        <p className="mt-4 text-center">Thank you for training with us.</p>
      </article>
    </main>
  )
}

export default function ReceiptPage() {
  return (
    <RoleGate allow={['member', 'receptionist', 'admin']}>
      <Receipt />
    </RoleGate>
  )
}
