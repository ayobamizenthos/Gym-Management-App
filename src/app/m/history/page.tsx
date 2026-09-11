'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { naira, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Payment } from '@/lib/types'

interface Row extends Payment {
  plan: { name: string } | null
}

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
  const [rows, setRows] = useState<Row[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!profile) return
    void supabase
      .from('payments')
      .select('*, plan:plan_id(name)')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setRows((data ?? []) as unknown as Row[])
        setReady(true)
      })
  }, [profile])

  return (
    <div className="animate-rise">
      <h1 className="text-4xl">Payments</h1>

      {ready && rows.length === 0 && (
        <p className="mt-6 text-sm text-mute">No payments recorded yet.</p>
      )}

      <ul className="mt-6 flex flex-col gap-2">
        {rows.map(row => (
          <li key={row.id} className="flex items-center justify-between border-l-2 border-edge bg-base-panel px-4 py-4">
            <span className="min-w-0">
              <span className="block font-display text-xl uppercase tracking-tightest">
                {row.plan?.name ?? 'Payment'}
              </span>
              <span className="block text-xs text-mute">
                {shortDate(row.created_at)}
                {row.includes_registration ? ' / includes registration' : ''}
              </span>
            </span>
            <span className="text-right">
              <span className="block font-display text-xl tabular-nums">{naira(row.amount)}</span>
              <span className={cn('block text-xs font-semibold uppercase tracking-wide', TONE[row.status])}>
                {WORD[row.status]}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
