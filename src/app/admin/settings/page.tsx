'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { Accordion } from '@/components/Accordion'
import { NotificationToggle } from '@/components/NotificationToggle'
import type { Settings } from '@/lib/types'

const FIELDS = [
  'gym_name',
  'registration_fee',
  'referral_target',
  'referral_reward_days',
  'expiry_notice_days',
  'checkin_window_hours',
] as const

type Field = (typeof FIELDS)[number]
type Draft = Record<Field, string>

const toDraft = (row: Settings): Draft =>
  FIELDS.reduce((out, key) => ({ ...out, [key]: String(row[key] ?? '') }), {} as Draft)

export default function AdminSettings() {
  const push = useToasts(s => s.push)
  const { signOut } = useAuth()
  const router = useRouter()
  const [stored, setStored] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  useEffect(() => {
    void supabase.from('settings').select('*').maybeSingle().then(({ data }) => {
      if (!data) return
      const next = toDraft(data as Settings)
      setStored(next)
      setDraft(next)
    })
  }, [])

  // Typing something and then undoing it is not a change, so the button goes
  // quiet again rather than staying lit on an edit that no longer exists.
  const dirty = useMemo(
    () => Boolean(stored && draft && FIELDS.some(key => draft[key].trim() !== stored[key].trim())),
    [stored, draft]
  )

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl space-y-2" aria-busy="true" aria-label="Loading settings">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm bg-base-panel" />
        ))}
      </div>
    )
  }

  const set = (key: Field) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDraft(current => (current ? { ...current, [key]: e.target.value } : current))

  const save = async () => {
    setBusy(true)
    const { error } = await supabase
      .from('settings')
      .update({
        gym_name: draft.gym_name.trim(),
        registration_fee: Number(draft.registration_fee),
        referral_target: Number(draft.referral_target),
        referral_reward_days: Number(draft.referral_reward_days),
        expiry_notice_days: Number(draft.expiry_notice_days),
        checkin_window_hours: Number(draft.checkin_window_hours),
        updated_at: new Date().toISOString(),
      })
      .eq('id', true)
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    // reference data changed - drop the copy members are holding
    try { localStorage.removeItem('zg:settings') } catch {}
    setStored(draft)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 2200)
    push({ tone: 'good', title: 'Settings saved' })
  }

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Settings</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">These rules drive the whole system.</p>

      <div className="mt-7">
        <Accordion title="Gym" defaultOpen>
          <Row label="Gym name">
            <input value={draft.gym_name} onChange={set('gym_name')} className="field" />
          </Row>
          <Row label="Registration fee">
            <input type="number" min="0" inputMode="numeric" value={draft.registration_fee} onChange={set('registration_fee')} className="field" />
          </Row>
        </Accordion>

        <Accordion title="Renewals">
          <Row label="Renewal notice (days)">
            <input type="number" min="1" inputMode="numeric" value={draft.expiry_notice_days} onChange={set('expiry_notice_days')} className="field" />
          </Row>
        </Accordion>

        <Accordion title="Referrals">
          <Row label="Referrals needed">
            <input type="number" min="1" inputMode="numeric" value={draft.referral_target} onChange={set('referral_target')} className="field" />
          </Row>
          <Row label="Reward (days)">
            <input type="number" min="1" inputMode="numeric" value={draft.referral_reward_days} onChange={set('referral_reward_days')} className="field" />
          </Row>
        </Accordion>

        <Accordion title="Check-in">
          <Row label="Repeat scan window (hours)">
            <input type="number" min="1" inputMode="numeric" value={draft.checkin_window_hours} onChange={set('checkin_window_hours')} className="field" />
          </Row>
        </Accordion>

        <Accordion title="Alerts">
          <NotificationToggle />
        </Accordion>
      </div>

      <button onClick={save} disabled={!dirty || busy} className="btn-primary mt-7 w-full">
        {justSaved ? 'Saved' : busy ? <span className="dots">Saving</span> : 'Save settings'}
      </button>

      <button
        onClick={async () => {
          await signOut()
          router.replace('/login')
        }}
        className="mt-8 flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold text-out"
      >
        <LogOut size={17} aria-hidden /> Sign out
      </button>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block last:mb-0">
      <span className="label">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}
