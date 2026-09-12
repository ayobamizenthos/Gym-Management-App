'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { KeyRound, Copy, Check, Pencil, Trash2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { playPaid } from '@/lib/sounds'
import { Avatar } from '@/components/Avatar'
import { Accordion } from '@/components/Accordion'
import { Loader } from '@/components/Loader'
import { Dialog } from '@/components/Dialog'
import { BackLink } from '@/components/BackLink'
import { Select } from '@/components/Select'
import { daysLeft, naira, shortDate, timeOnly } from '@/lib/format'
import { cn } from '@/lib/cn'
import { isReachableEmail } from '@/lib/members'
import type { CheckInRow, Payment, Plan, Profile } from '@/lib/types'

interface PaymentRow extends Payment {
  plan: { name: string } | null
}

const STATUS_TONE: Record<Payment['status'], string> = {
  confirmed: 'text-live',
  pending: 'text-due',
  rejected: 'text-out',
}

export default function MemberDetail() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { profile: viewer } = useAuth()
  const push = useToasts(s => s.push)

  const [member, setMember] = useState<Profile | null>(null)
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<PaymentRow[]>([])
  const [visits, setVisits] = useState<CheckInRow[]>([])
  const [planId, setPlanId] = useState('')
  const [method, setMethod] = useState<'cash' | 'transfer'>('cash')
  const [busy, setBusy] = useState(false)
  const [edits, setEdits] = useState({ full_name: '', phone: '', address: '', emergency_contact: '', date_of_birth: '' })
  const [editing, setEditing] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [issued, setIssued] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    const [m, p, v] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
      supabase
        .from('payments')
        .select('*, plan:plan_id(name)')
        .eq('user_id', id)
        .order('created_at', { ascending: false }),
      supabase
        .from('check_ins')
        .select('*')
        .eq('user_id', id)
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    setMember(m.data as Profile)
    setPayments((p.data ?? []) as unknown as PaymentRow[])
    setVisits((v.data ?? []) as CheckInRow[])
  }, [id])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!member) return
    setEdits({
      full_name: member.full_name ?? '',
      phone: member.phone ?? '',
      address: member.address ?? '',
      emergency_contact: member.emergency_contact ?? '',
      date_of_birth: member.date_of_birth ?? '',
    })
  }, [member])

  useEffect(() => {
    void supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
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
    if (error) {
      push({ tone: 'bad', title: 'Could not record', message: error.message })
    } else {
      if (method === 'cash') playPaid()
      push({
        tone: 'good',
        title: method === 'cash' ? 'Payment recorded' : 'Logged as pending',
        message: method === 'cash' ? 'Days added immediately.' : 'Confirm once the transfer lands.',
      })
      await load()
    }
    setBusy(false)
  }

  const saveDetails = async () => {
    setEditing(true)
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: edits.full_name.trim() || null,
        phone: edits.phone.trim() || null,
        address: edits.address.trim() || null,
        emergency_contact: edits.emergency_contact.trim() || null,
        date_of_birth: edits.date_of_birth || null,
      })
      .eq('id', id)
    setEditing(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    push({ tone: 'good', title: 'Details updated' })
    await load()
  }

  const resetPassword = async () => {
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/staff/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.session?.access_token },
      body: JSON.stringify({ user_id: id }),
    })
    const payload = await res.json()
    if (!res.ok) {
      push({ tone: 'bad', title: 'Could not reset', message: payload.error })
      return
    }
    setIssued(payload.password)
    setCopied(false)
  }

  const copyPassword = async () => {
    if (!issued) return
    try {
      await navigator.clipboard.writeText(issued)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      push({ tone: 'info', title: 'Copy it by hand', message: 'This browser blocked the clipboard.' })
    }
  }

  const deleteAccount = async () => {
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/delete-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.session?.access_token },
      body: JSON.stringify({ user_id: id }),
    })
    const payload = await res.json()
    if (!res.ok) {
      push({ tone: 'bad', title: 'Not deleted', message: payload.error })
      return
    }
    push({ tone: 'info', title: 'Account deleted' })
    router.replace('/desk/members')
  }

  if (!member) return <Loader />

  const left = daysLeft(member.expires_at)
  const active = left !== null && left > 0
  const chosen = plans.find(p => p.id === planId)
  // the plan they are on is whatever their last confirmed membership payment
  // bought - it is a record of what they paid, never something to edit
  const currentPlan = payments.find(row => row.status === 'confirmed' && row.plan?.name)?.plan?.name ?? null
  const totalPaid = payments
    .filter(p => p.status === 'confirmed')
    .reduce((sum, p) => sum + Number(p.amount), 0)

  return (
    <div className="mx-auto max-w-2xl animate-rise">
      <BackLink fallback="/desk/members" label="Members" />

      <header className="mt-5 flex items-start gap-4">
        <Avatar path={member.photo_url} name={member.full_name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-3xl">{member.full_name ?? 'Member'}</h1>
          <p className="mt-1 truncate text-[15px] text-chalk-dim">{member.phone ?? 'No phone on file'}</p>
        </div>
      </header>

      <div
        className={cn(
          'mt-5 flex items-center justify-between rounded-lg px-4 py-3.5',
          active ? 'bg-live-tint' : member.expires_at && member.pending_days === 0 ? 'bg-out-tint' : 'bg-base-panel'
        )}
      >
        <span className="text-[15px] font-medium">
          {active ? 'Active' : member.pending_days > 0 ? 'Paid, not started' : member.expires_at ? 'Expired' : 'No plan yet'}
        </span>
        <span className={cn('figure text-2xl', !member.expires_at ? 'text-mute' : active ? 'text-live' : 'text-out')}>
          {active
            ? left + ' days'
            : member.pending_days > 0
              ? member.pending_days + ' days ready'
              : member.expires_at
                ? shortDate(member.expires_at)
                : '--'}
        </span>
      </div>

      {currentPlan && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg bg-base-panel px-4 py-3">
          <span className="label">Current plan</span>
          <span className="truncate text-[15px] font-medium">{currentPlan}</span>
        </div>
      )}

      <div className="mt-8">
        <Accordion title="Record a payment" defaultOpen>
          <p className="mb-4 text-[15px] text-chalk-dim">
            Money taken at the desk. This adds to their membership; it never edits a payment
            they have already made.
          </p>
          <div className="flex flex-col gap-2.5">
            <div className="block">
              <span className="label">Plan</span>
              <div className="mt-1.5">
                <Select
                  value={planId}
                  label="Plan"
                  onChange={setPlanId}
                  options={plans.map(p => ({ value: p.id, label: p.name, hint: naira(p.price) }))}
                />
              </div>
            </div>
            <div className="block">
              <span className="label">How they paid</span>
              <div className="mt-1.5">
                <Select
                  value={method}
                  label="How they paid"
                  onChange={value => setMethod(value as 'cash' | 'transfer')}
                  options={[
                    { value: 'cash', label: 'Cash', hint: 'Days added now' },
                    { value: 'transfer', label: 'Transfer', hint: 'Confirm it on Payments once it lands' },
                  ]}
                />
              </div>
            </div>
            {chosen && chosen.requires_registration && !member.registration_paid && (
              <p className="text-sm text-due">A joining fee will be added to this payment.</p>
            )}
            <button onClick={take} disabled={busy || !planId} className="btn-primary mt-1 w-full">
              {busy ? <span className="dots">Saving</span> : 'Record payment'}
            </button>
          </div>
        </Accordion>

        <Accordion title="Details">
          <dl className="divide-y divide-edge-soft">
            {[
              ['Member code', member.member_code],
              ['Username', member.username],
              ['Email', isReachableEmail(member.email) ? member.email : 'None on file'],
              ['Phone', member.phone],
              ['Address', member.address],
              ['Date of birth', member.date_of_birth ? shortDate(member.date_of_birth) : null],
              ['Emergency contact', member.emergency_contact],
              ['Joined', shortDate(member.created_at)],
              ['Joining fee', member.registration_paid ? 'Paid' : 'Not paid'],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-baseline justify-between gap-4 py-2.5">
                <dt className="label shrink-0">{label}</dt>
                <dd className="truncate text-right text-[15px]">{value || '--'}</dd>
              </div>
            ))}
          </dl>
        </Accordion>

        <Accordion title="Correct details">
          <p className="mb-4 text-[15px] text-chalk-dim">
            Members keep their own phone, address and emergency contact current. The name and date of
            birth are yours to correct, because the desk reads them off the check-in screen.
          </p>
          <div className="flex flex-col gap-3.5">
            <label className="block">
              <span className="label">Full name</span>
              <input value={edits.full_name} onChange={e => setEdits({ ...edits, full_name: e.target.value })} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Date of birth</span>
              <input type="date" value={edits.date_of_birth} onChange={e => setEdits({ ...edits, date_of_birth: e.target.value })} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Phone</span>
              <input inputMode="tel" value={edits.phone} onChange={e => setEdits({ ...edits, phone: e.target.value })} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Address</span>
              <input value={edits.address} onChange={e => setEdits({ ...edits, address: e.target.value })} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Emergency contact</span>
              <input value={edits.emergency_contact} onChange={e => setEdits({ ...edits, emergency_contact: e.target.value })} className="field mt-1.5" />
            </label>
          </div>
          <button onClick={saveDetails} disabled={editing} className="btn-primary mt-5 w-full">
            {editing ? <span className="dots">Saving</span> : <><Pencil size={16} aria-hidden /> Save details</>}
          </button>
        </Accordion>

        <Accordion title="Sign-in help">
          {issued ? (
            <div className="rounded-sm border border-live p-4">
              <p className="text-[15px] font-semibold">New password issued</p>
              <p className="mt-1 text-sm text-chalk-dim">
                Read it to the member now. It is not shown again.
              </p>
              <p className="mt-3 rounded-sm bg-base-raised px-3 py-2 text-center font-mono text-lg tracking-wider">
                {issued}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button onClick={() => void copyPassword()} className="btn-quiet w-full">
                  {copied ? <><Check size={16} aria-hidden /> Copied</> : <><Copy size={16} aria-hidden /> Copy</>}
                </button>
                <button onClick={() => setIssued(null)} className="btn-primary w-full">Done</button>
              </div>
            </div>
          ) : (
            <>
              <p className="text-[15px] text-chalk-dim">
                {isReachableEmail(member.email)
                  ? 'They can reset it themselves by email, or you can hand them a new one now.'
                  : 'This member has no email on file, so a new password has to come from the desk.'}
              </p>
              <p className="mt-3 text-sm text-mute">
                They sign in with{' '}
                <span className="text-chalk">
                  {member.username ?? (isReachableEmail(member.email) ? member.email : 'no name set yet')}
                </span>
                {member.username && isReachableEmail(member.email) ? ' or their email.' : '.'}
              </p>
              <button onClick={() => setResetting(true)} className="btn-quiet mt-4 w-full">
                <KeyRound size={16} aria-hidden /> Issue a new password
              </button>
            </>
          )}
        </Accordion>

        <Accordion title="Payment history" count={payments.length}>
          {payments.length === 0 ? (
            <p className="text-sm text-mute">No payments recorded.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-mute">
                Total paid <span className="font-semibold text-chalk">{naira(totalPaid)}</span>
              </p>
              <ul role="list" className="flex flex-col gap-1.5">
                {payments.map(row => (
                  <li
                    key={row.id}
                    className="flex items-center justify-between gap-3 rounded-sm bg-base-panel px-3.5 py-2.5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px]">{row.plan?.name ?? 'Payment'}</span>
                      <span className="block text-xs text-mute">
                        {shortDate(row.created_at)} · {row.method}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-[15px] font-semibold tabular-nums">{naira(row.amount)}</span>
                      <span className={cn('block text-xs font-semibold', STATUS_TONE[row.status])}>
                        {row.status}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Accordion>

        {viewer?.role === 'admin' && (
          <Accordion title="Delete account">
            <p className="text-[15px] text-chalk-dim">
              Removes the member, their sign-in and their history for good. Only an owner can do
              this, and it cannot be undone.
            </p>
            <button
              onClick={() => setDeleting(true)}
              className="btn mt-4 w-full rounded-sm border border-out text-out hover:bg-out-tint"
            >
              <Trash2 size={16} aria-hidden /> Delete this account
            </button>
          </Accordion>
        )}

        <Accordion title="Visits" count={visits.length}>
          {visits.length === 0 ? (
            <p className="text-sm text-mute">No check-ins recorded.</p>
          ) : (
            <ul role="list" className="flex flex-col gap-1.5">
              {visits.map(v => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded-sm bg-base-panel px-3.5 py-2.5 text-[15px]"
                >
                  <span>{shortDate(v.created_at)}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums text-mute">{timeOnly(v.created_at)}</span>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        v.kind === 'valid' ? 'text-live' : v.kind === 'expired' ? 'text-out' : 'text-mute'
                      )}
                    >
                      {v.kind.replace('_', ' ')}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Accordion>
      </div>

      {deleting && (
        <Dialog
          title={'Delete ' + (member.full_name ?? 'this account') + '?'}
          body="Their membership, payment history and visits are removed with them. This cannot be undone."
          ask="Type DELETE to confirm"
          requireText="DELETE"
          confirmLabel="Delete"
          tone="danger"
          onConfirm={deleteAccount}
          onClose={() => setDeleting(false)}
        />
      )}

      {resetting && (
        <Dialog
          title="Issue a new password?"
          body={'The password ' + (member.full_name ?? 'this member') + ' has now will stop working straight away.'}
          confirmLabel="Issue"
          onConfirm={resetPassword}
          onClose={() => setResetting(false)}
        />
      )}
    </div>
  )
}
