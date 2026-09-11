'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserPlus, Shield } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import type { Branch, Profile, Role } from '@/lib/types'

export default function AdminStaff() {
  const push = useToasts(s => s.push)
  const [rows, setRows] = useState<Profile[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState({ full_name: '', email: '', role: 'receptionist', branch_id: '' })
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

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
    setForm({ full_name: '', email: '', role: 'receptionist', branch_id: '' })
    await load()
  }

  const setRole = async (id: string, role: Role) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, role } : r)))
    const { error } = await supabase.from('profiles').update({ role }).eq('id', id)
    if (error) push({ tone: 'bad', title: 'Not changed', message: error.message })
  }

  return (
    <div className="max-w-2xl animate-rise">
      <h1 className="text-4xl lg:text-5xl">Staff</h1>
      <p className="mt-2 text-sm text-mute">
        Front desk sees members and payments. Admin sees everything including revenue.
      </p>

      <div className="rule mt-6" />

      <ul className="mt-5 flex flex-col gap-2">
        {rows.map(r => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 bg-base-panel px-4 py-3.5">
            <span className="min-w-0">
              <span className="flex items-center gap-2 font-semibold">
                {r.role === 'admin' && <Shield size={15} className="text-live" />}
                {r.full_name ?? 'Staff'}
              </span>
              <span className="block text-sm text-mute">{r.role === 'admin' ? 'Administrator' : 'Front desk'}</span>
            </span>
            <select
              value={r.role}
              onChange={e => setRole(r.id, e.target.value as Role)}
              className="field h-10 w-40"
            >
              <option value="receptionist">Receptionist</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
            </select>
          </li>
        ))}
      </ul>

      <div className="rule mt-8" />

      {created ? (
        <section className="mt-6 border border-live p-4">
          <h2 className="text-2xl">Account created</h2>
          <p className="mt-2 text-sm text-mute">Share these details with the staff member.</p>
          <p className="mt-3 text-sm">Email: <span className="font-mono">{created.email}</span></p>
          <p className="text-sm">Password: <span className="font-mono">{created.password}</span></p>
          <button onClick={() => setCreated(null)} className="btn-quiet mt-4">Add another</button>
        </section>
      ) : (
        <section className="mt-6">
          <h2 className="text-2xl">Add staff</h2>
          <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
            <input required placeholder="Full name" value={form.full_name}
              onChange={e => setForm({ ...form, full_name: e.target.value })} className="field" />
            <input required type="email" placeholder="Email" value={form.email}
              onChange={e => setForm({ ...form, email: e.target.value })} className="field" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="field">
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
              <select value={form.branch_id} onChange={e => setForm({ ...form, branch_id: e.target.value })} className="field">
                <option value="">No branch</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <button type="submit" disabled={busy} className="btn-primary mt-1">
              <UserPlus size={17} /> {busy ? 'Creating' : 'Create account'}
            </button>
          </form>
        </section>
      )}
    </div>
  )
}
