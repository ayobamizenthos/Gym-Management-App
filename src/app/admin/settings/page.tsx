'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToasts } from '@/stores/toast'
import { Accordion } from '@/components/Accordion'
import { naira } from '@/lib/format'
import type { Settings } from '@/lib/types'

export default function AdminSettings() {
  const push = useToasts(s => s.push)
  const [form, setForm] = useState<Settings | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void supabase.from('settings').select('*').maybeSingle().then(({ data }) => setForm(data as Settings))
  }, [])

  if (!form) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading settings">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm bg-base-panel" />
        ))}
      </div>
    )
  }

  const set = (key: keyof Settings) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [key]: e.target.value } as Settings)

  const save = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('settings')
      .update({
        gym_name: form.gym_name,
        registration_fee: Number(form.registration_fee),
        referral_target: Number(form.referral_target),
        referral_reward_days: Number(form.referral_reward_days),
        expiry_notice_days: Number(form.expiry_notice_days),
        checkin_window_hours: Number(form.checkin_window_hours),
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    // reference data changed - drop the cached copy members are holding
    try {
      localStorage.removeItem('zg:settings')
    } catch {}
    setSaved(true)
    setTimeout(() => setSaved(false), 2200)
    push({ tone: 'good', title: 'Settings saved' })
  }

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Settings</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">These rules drive the whole system.</p>

      <div className="mt-7">
        <Accordion title="Gym" defaultOpen>
          <Field label="Gym name" hint="Shown across the app">
            <input value={form.gym_name} onChange={set('gym_name')} className="field" />
          </Field>
          <Field label="Joining fee" hint={'Charged once, on a member’s first membership payment. Walk-ins never pay it.'}>
            <input
              type="number"
              min="0"
              inputMode="numeric"
              value={Number(form.registration_fee)}
              onChange={set('registration_fee')}
              className="field"
            />
            <span className="mt-1.5 block text-sm text-mute">{naira(form.registration_fee)}</span>
          </Field>
        </Accordion>

        <Accordion title="Renewals">
          <Field label="Renewal notice (days)" hint="How early a member counts as due for renewal">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.expiry_notice_days}
              onChange={set('expiry_notice_days')}
              className="field"
            />
          </Field>
        </Accordion>

        <Accordion title="Referrals">
          <Field label="Referrals needed" hint="Paid referrals required before the reward unlocks">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.referral_target}
              onChange={set('referral_target')}
              className="field"
            />
          </Field>
          <Field label="Reward (days)" hint="Free days added when the target is reached">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.referral_reward_days}
              onChange={set('referral_reward_days')}
              className="field"
            />
          </Field>
        </Accordion>

        <Accordion title="Check-in">
          <Field label="Repeat scan window (hours)" hint="A second scan inside this window counts as the same visit">
            <input
              type="number"
              min="1"
              inputMode="numeric"
              value={form.checkin_window_hours}
              onChange={set('checkin_window_hours')}
              className="field"
            />
          </Field>
        </Accordion>
      </div>

      <button onClick={save} disabled={busy} className="btn-primary mt-7 w-full">
        {saved ? 'Saved' : busy ? <span className="dots">Saving</span> : 'Save settings'}
      </button>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block last:mb-0">
      <span className="label">{label}</span>
      <span className="mt-1.5 block">{children}</span>
      <span className="mt-1.5 block text-sm text-mute">{hint}</span>
    </label>
  )
}
