'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Shield, Copy, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { Accordion } from '@/components/Accordion'
import { Dialog } from '@/components/Dialog'
import { Select } from '@/components/Select'
import type { Branch, Profile, Role } from '@/lib/types'

const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  receptionist: 'Front desk',
  member: 'Member',
}

export default function AdminStaff() {
  const { profile } = useAuth()
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState({ full_name: '', email: '', role: 'receptionist', branch_id: '' })
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)
  const [copied, setCopied] = useState(false)
  const [demoting, setDemoting] = useState<{ person: Profile; role: Role } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('profiles').select('*').neq('role', 'member').order('role')
    setRows((data ?? []) as Profile[])
  }, [])

  useEffect(() => { void load() }, [load])
  useEffect(() => {
    void supabase.from('branches').select('*').order('name').then(({ data }) => setBranches((data ?? []) as Branch[]))
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const { data: s } = await supabase.auth.getSession()
    const res = await fetch('/api/admin/create-staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + s.session?.access_token },
      body: JSON.stringify({ ...form, branch_id: form.branch_id || null }),
    })
    const payload = await res.json()
    setBusy(false)
    if (!res.ok) {
      push({ tone: 'bad', title: 'Could not create', message: payload.error })
      return
    }
    setCreated({ email: payload.email, password: payload.password })
    setCopied(false)
    setForm({ full_name: '', email: '', role: 'receptionist', branch_id: '' })
    await load()
  }

  const applyRole = async (person: Profile, role: Role) => {
    setRows(prev => prev.map(r => (r.id === person.id ? { ...r, role } : r)))
    const { error } = await supabase.from('profiles').update({ role }).eq('id', person.id)
    if (error) {
      push({ tone: 'bad', title: 'Not changed', message: error.message })
      await load()
      return
    }
    push({ tone: 'good', title: 'Role updated', message: (person.full_name ?? 'Staff') + ' is now ' + ROLE_LABEL[role].toLowerCase() + '.' })
    if (role === 'member') await load()
  }

  const chooseRole = (person: Profile, role: Role) => {
    if (role === person.role) return
    // Losing your own admin rights locks you out of this screen entirely.
    const losingOwnAccess = person.id === profile?.id && role !== 'admin'
    if (losingOwnAccess || role === 'member') {
      setDemoting({ person, role })
      return
    }
    void applyRole(person, role)
  }

  const copyLogin = async () => {
    if (!created) return
    try {
      await navigator.clipboard.writeText(created.email + '\n' + created.password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      push({ tone: 'info', title: 'Copy it by hand', message: 'This browser blocked the clipboard.' })
    }
  }

  return (
    <div className="max-w-2xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Staff</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">
        Front desk sees members and payments. Admin sees everything including revenue.
      </p>


      <ul role="list" className="mt-5 flex flex-col gap-2">
        {rows.map(r => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-base-panel px-4 py-3.5">
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                {r.role === 'admin' && <Shield size={15} className="text-live" aria-hidden />}
                <span className="truncate">{r.full_name ?? 'Staff'}</span>
                {r.id === profile?.id && (
                  <span className="rounded-full bg-base-raised px-2 py-0.5 text-[10px] uppercase tracking-wide text-mute">You</span>
                )}
              </span>
              <span className="block truncate text-sm text-mute">{r.email ?? ROLE_LABEL[r.role]}</span>
            </span>
            <Select
              value={r.role}
              label={'Role for ' + (r.full_name ?? 'staff member')}
              onChange={value => chooseRole(r, value as Role)}
              className="w-40 shrink-0 [&_button]:h-10 [&_button]:text-sm"
              options={[
                { value: 'receptionist', label: 'Receptionist' },
                { value: 'admin', label: 'Admin' },
                { value: 'member', label: 'Member' },
              ]}
            />
          </li>
        ))}
      </ul>

      <div className="mt-8">
        {created ? (
          <section className="rounded-lg bg-live-tint p-5">
            <h2 className="text-2xl">Account created</h2>
            <p className="mt-2 text-[15px] text-chalk-dim">
              Share these once. The password is not stored anywhere you can read it again.
            </p>
            <dl className="mt-4 rounded-md bg-base px-4 py-3 text-sm">
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-mute">Email</dt>
                <dd className="truncate font-mono">{created.email}</dd>
              </div>
              <div className="flex justify-between gap-4 py-1">
                <dt className="text-mute">Password</dt>
                <dd className="font-mono">{created.password}</dd>
              </div>
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              <button onClick={() => void copyLogin()} className="btn-quiet w-full">
                {copied ? <><Check size={16} aria-hidden /> Copied</> : <><Copy size={16} aria-hidden /> Copy</>}
              </button>
              <button onClick={() => setCreated(null)} className="btn-primary w-full">Done</button>
            </div>
          </section>
        ) : (
          <Accordion title="Add staff">
            <form onSubmit={submit} className="flex flex-col gap-3">
              <input required placeholder="Full name" autoComplete="off" value={form.full_name}
                onChange={e => setForm({ ...form, full_name: e.target.value })} className="field" />
              <input required type="email" placeholder="Email" autoComplete="off" inputMode="email" value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })} className="field" />
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  value={form.role}
                  label="Role"
                  onChange={value => setForm({ ...form, role: value })}
                  options={[
                    { value: 'receptionist', label: 'Receptionist', hint: 'Members and payments' },
                    { value: 'admin', label: 'Admin', hint: 'Everything, including revenue' },
                  ]}
                />
                <Select
                  value={form.branch_id}
                  label="Branch"
                  placeholder="No branch"
                  onChange={value => setForm({ ...form, branch_id: value })}
                  options={[{ value: '', label: 'No branch' }, ...branches.map(b => ({ value: b.id, label: b.name }))]}
                />
              </div>
              <button type="submit" disabled={busy} className="btn-primary mt-1">
                {busy ? <span className="dots">Creating</span> : <><UserPlus size={17} aria-hidden /> Create account</>}
              </button>
            </form>
          </Accordion>
        )}
      </div>

      {demoting && (
        <Dialog
          title={demoting.person.id === profile?.id ? 'Give up your own access?' : 'Change access?'}
          body={
            demoting.person.id === profile?.id
              ? 'You will lose the admin area immediately and another admin will have to restore it.'
              : (demoting.person.full_name ?? 'This person') +
                ' will lose the staff area and keep only a member account.'
          }
          confirmLabel="Change"
          tone="danger"
          onConfirm={() => applyRole(demoting.person, demoting.role)}
          onClose={() => { setDemoting(null); void load() }}
        />
      )}
    </div>
  )
}
