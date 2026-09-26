'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { BackLink } from '@/components/BackLink'
import { postJson } from '@/lib/post-json'
import { localDate } from '@/lib/format'
import { isReachableEmail } from '@/lib/members'
import { Select } from '@/components/Select'
import { UsernameField } from '@/components/UsernameField'
import type { Branch } from '@/lib/types'

export default function RegisterMember() {
  const router = useRouter()
  const { profile } = useAuth()
  const push = useToasts(s => s.push)
  const [branches, setBranches] = useState<Branch[]>([])
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', date_of_birth: '', username: '', branch_id: '' })
  const [busy, setBusy] = useState(false)
  const [usernameOk, setUsernameOk] = useState(false)
  const [created, setCreated] = useState<{ login: string; password: string } | null>(null)

  useEffect(() => {
    void supabase.from('branches').select('*').eq('is_active', true).order('name')
      .then(({ data }) => {
        const list = (data ?? []) as Branch[]
        setBranches(list)
        setForm(f => ({ ...f, branch_id: profile?.branch_id ?? list[0]?.id ?? '' }))
      })
  }, [profile?.branch_id])

  const bindField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value })

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    const reply = await postJson<{ email: string; password: string }>('/api/staff/create-member', form, { signed: true })
    setBusy(false)
    if (!reply.ok) {
      push({ tone: 'bad', title: 'Could not register', message: reply.error })
      return
    }
    setCreated({ login: isReachableEmail(reply.body.email) ? reply.body.email : form.username, password: reply.body.password })
    push({ tone: 'good', title: 'Member registered' })
  }

  if (created) {
    return (
      <div className="max-w-md animate-rise">
        <h1 className="text-4xl">Member registered</h1>
        <p className="mt-3 text-[15px] text-chalk-dim">Give these sign-in details to the member.</p>
        <dl className="mt-6 overflow-hidden rounded-lg bg-base-panel">
          <div className="flex justify-between border-b border-edge-soft px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-mute">Sign in with</dt>
            <dd className="truncate pl-3 font-mono text-sm">{created.login}</dd>
          </div>
          <div className="flex justify-between px-4 py-3">
            <dt className="text-xs uppercase tracking-[0.2em] text-mute">Password</dt>
            <dd className="font-mono text-sm">{created.password}</dd>
          </div>
        </dl>
        <div className="mt-6 flex gap-2">
          <button onClick={() => { setCreated(null); setForm({ full_name: '', phone: '', email: '', date_of_birth: '', username: '', branch_id: form.branch_id }) }}
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
      <p className="mt-2 text-[15px] text-chalk-dim">Straight from the paper form.</p>

      <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
        <label className="block">
          <span className="label">Full name</span>
          <input required value={form.full_name} onChange={bindField('full_name')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input required inputMode="tel" value={form.phone} onChange={bindField('phone')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Email (optional)</span>
          <input type="email" inputMode="email" value={form.email} onChange={bindField('email')} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Date of birth</span>
          <input
            required
            type="date"
            max={localDate()}
            value={form.date_of_birth}
            onChange={bindField('date_of_birth')}
            className="field mt-1.5"
          />
        </label>
        <UsernameField
          required
          value={form.username}
          onChange={value => setForm(f => ({ ...f, username: value }))}
          onStateChange={setUsernameOk}
        />
        {profile?.role === 'admin' && branches.length > 1 && (
          <label className="block">
            <span className="label">Branch</span>
            <span className="mt-1.5 block">
              <Select
                value={form.branch_id}
                label="Branch"
                onChange={value => setForm(f => ({ ...f, branch_id: value }))}
                options={branches.map(b => ({ value: b.id, label: b.name, hint: b.address ?? undefined }))}
              />
            </span>
          </label>
        )}
        <button type="submit" disabled={busy || !usernameOk} className="btn-primary mt-2 w-full">
          {busy ? <span className="dots">Registering</span> : 'Register member'}
        </button>
      </form>
    </div>
  )
}
