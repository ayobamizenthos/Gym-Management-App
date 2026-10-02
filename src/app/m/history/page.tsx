'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { naira, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment } from '@/lib/types'

interface PaymentWithPlan extends Payment {
  plan: { name: string } | null
}

const SKELETON_ROWS = 3

const TONE: Record<Payment['status'], string> = {
  confirmed: 'text-live',
  pending: 'text-due',
  rejected: 'text-out',
}

const WORD: Record<Payment['status'], string> = {
  confirmed: 'Confirmed',
  pending: 'Awaiting desk',
  rejected: 'Rejected',
}

export default function HistoryPage() {
  const { profile } = useAuth()
  const [payments, setPayments] = useState<PaymentWithPlan[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!profile) return
    void supabase
      .from('payments')
      .select('*, plan:plan_id(name)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPayments((data ?? []) as unknown as PaymentWithPlan[])
        setReady(true)
      })
  }, [profile])

  return (
    <div className="animate-rise">
      <h1 className="text-3xl lg:text-4xl">Payments</h1>

      {!ready ? (
        <div className="mt-6 space-y-2" aria-busy="true" aria-label="Loading payments">
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <div key={i} className="h-[72px] animate-pulse rounded-sm bg-base-panel" />
          ))}
        </div>
      ) : payments.length === 0 ? (
        <p className="mt-6 text-[15px] text-mute">No payments recorded yet.</p>
      ) : null}

      <ul role="list" className="mt-6 flex flex-col gap-2">
        {payments.map(payment => (
          <li key={payment.id}>
            <Link href={`/receipt/${payment.id}`} className="flex items-center justify-between gap-3 rounded-lg bg-base-panel px-4 py-4 transition-colors active:bg-base-raised">
            <span className="min-w-0">
              <span className="block font-display text-xl uppercase tracking-tightest">
                {payment.plan?.name ?? 'Payment'}
              </span>
              <span className="block text-xs text-mute">
                {shortDate(payment.created_at)}
                {payment.includes_registration ? ' / includes joining fee' : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-display text-xl tabular-nums">{naira(payment.amount)}</span>
              <span className={cn('block text-xs font-semibold uppercase tracking-wide', TONE[payment.status])}>
                {WORD[payment.status]}
              </span>
            </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
