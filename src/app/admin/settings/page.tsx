'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import type { Settings } from '@/lib/types'

export default function AdminSettings() {
  const push = useToasts(s => s.push)
  const [form, setForm] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void supabase.from('settings').select('*').maybeSingle().then(({ data }) => setForm(data as Settings))
  }, [])

  if (!form) return null

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value } as Settings)

  const save = async () => {
    setBusy(true)
    const { error } = await supabase.from('settings').update({
      gym_name: form.gym_name,
      registration_fee: Number(form.registration_fee),
      referral_target: Number(form.referral_target),
      referral_reward_days: Number(form.referral_reward_days),
      expiry_notice_days: Number(form.expiry_notice_days),
      checkin_window_hours: Number(form.checkin_window_hours),
      updated_at: new Date().toISOString(),
    }).eq('id', true)
    setBusy(false)
    if (error) push({ tone: 'bad', title: 'Not saved', message: error.message })
    else { setSaved(true); setTimeout(() => setSaved(false), 2200) }
  }

  return (
    <div className="max-w-xl animate-rise">
      <h1 className="text-4xl lg:text-5xl">Settings</h1>
      <p className="mt-2 text-sm text-ink-mute">These rules drive the whole system.</p>

      <div className="rule mt-6" />

      <div className="mt-6 flex flex-col gap-5">
        <Field label="Gym name" hint="Shown across the app">
          <input value={form.gym_name} onChange={set('gym_name')} className="field" />
        </Field>
        <Field label="Registration fee" hint="Charged once, on a member's first membership payment">
          <input type="number" min="0" value={Number(form.registration_fee)} onChange={set('registration_fee')} className="field" />
        </Field>
        <Field label="Referrals needed" hint="Paid referrals required before the reward unlocks">
          <input type="number" min="1" value={form.referral_target} onChange={set('referral_target')} className="field" />
        </Field>
        <Field label="Referral reward (days)" hint="Free days added when the target is reached">
          <input type="number" min="1" value={form.referral_reward_days} onChange={set('referral_reward_days')} className="field" />
        </Field>
        <Field label="Renewal notice (days)" hint="How early a member counts as due for renewal">
          <input type="number" min="1" value={form.expiry_notice_days} onChange={set('expiry_notice_days')} className="field" />
        </Field>
        <Field label="Repeat scan window (hours)" hint="A second scan inside this window is treated as the same visit">
          <input type="number" min="1" value={form.checkin_window_hours} onChange={set('checkin_window_hours')} className="field" />
        </Field>
      </div>

      <button onClick={save} disabled={busy} className="btn-volt mt-8 w-full">
        {saved ? <><Check size={18} /> Saved</> : busy ? 'Saving' : 'Save settings'}
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">{label}</span>
      <span className="mt-2 block">{children}</span>
      <span className="mt-1.5 block text-xs text-ink-mute">{hint}</span>
    </label>
  )
}
