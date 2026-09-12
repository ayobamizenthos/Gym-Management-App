'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { BackLink } from '@/components/BackLink'
import type { Branch } from '@/lib/types'

export default function RegisterMember() {
  const router = useRouter()
  const { profile } = useAuth()
  const push = useToasts(s => s.push)
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', username: '', branch_id: '' })
  const [busy, setBusy] = useState(false)
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    void supabase.from('branches').select('*').eq('is_active', true).order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Branch[]
        setBranches(list)
        setForm(f => ({ ...f, branch_id: profile?.branch_id ?? list[0]?.id ?? '' }))
      })
  }, [profile?.branch_id])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    const res = await fetch('/api/staff/create-member', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(form),
    })
    const payload = await res.json()
    setBusy(false)
    if (!res.ok) {
      push({ tone: 'bad', title: 'Could not register', message: payload.error })
      return
    }
    setCreated({ email: payload.email, password: payload.password })
    push({ tone: 'good', title: 'Member registered' })
  }

  if (created) {
    return (
      <div className="max-w-md animate-rise">
        <h1 className="text-4xl">Member registered</h1>
        <p className="mt-3 text-[15px] text-chalk-dim">Give these sign-in details to the member.</p>
        <dl className="mt-6 border border-edge">
          <div className="flex justify-between border-b border-edge px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-mute">Email</dt>
            <dd className="truncate pl-3 font-mono text-sm">{created.email}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-mute">Password</dt>
            <dd className="font-mono text-sm">{created.password}</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-2">
          <button onClick={() => { setCreated(null); setForm({ full_name: '', phone: '', email: '', username: '', branch_id: form.branch_id }) }}
            className="btn-primary flex-1">Register another</button>
          <button onClick={() => router.push('/desk/members')} className="btn-quiet flex-1">Done</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-md animate-rise">
      <BackLink fallback="/desk/members" label="Members" />
      <h1 className="mt-4 text-4xl">Register member</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">From the paper form. Email is optional.</p>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
        <label className="block">
          <span className="label">Full name</span>
          <input required value={form.full_name} onChange={set('full_name')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input required inputMode="tel" value={form.phone} onChange={set('phone')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Email (optional)</span>
          <input type="email" value={form.email} onChange={set('email')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Username (optional)</span>
          <input value={form.username} onChange={set('username')} placeholder="yourname" className="field mt-1.5" />
        </label>
        {branches.length > 1 && (
          <label className="block">
            <span className="label">Branch</span>
            <select value={form.branch_id} onChange={set('branch_id')} className="field mt-1.5">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </label>
        )}
        <button type="submit" disabled={busy} className="btn-primary mt-2 w-full">
          {busy ? <span className="dots">Registering</span> : 'Register member'}
        </button>
      </form>
    </div>
  )
}
