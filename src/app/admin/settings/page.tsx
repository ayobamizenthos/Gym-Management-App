'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { useSettings } from '@/hooks/useSettings'
import { Accordion } from '@/components/Accordion'
import { NotificationToggle } from '@/components/NotificationToggle'
import { SoundPreview } from '@/components/SoundPreview'
import { parseWholeNumber } from '@/lib/format'
import type { Settings } from '@/lib/types'

const NUMBER_FIELDS = [
  'registration_fee',
  'referral_target',
  'referral_reward_days',
  'expiry_notice_days',
  'checkin_window_hours',
] as const

const FIELDS = NUMBER_FIELDS
const SAVED_FEEDBACK_MS = 2200
const SKELETON_ROWS = 5

type Field = (typeof FIELDS)[number]
type Draft = Record<Field, string>

const toDraft = (row: Settings): Draft =>
  FIELDS.reduce((out, key) => ({ ...out, [key]: String(row[key] ?? '') }), {} as Draft)

export default function AdminSettings() {
  const push = useToasts(s => s.push)
  const { signOut } = useAuth()
  const router = useRouter()
  const { settings, loaded, settled, revalidate } = useSettings()
  const [stored, setStored] = useState<Draft | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [busy, setBusy] = useState(false)
  const [justSaved, setJustSaved] = useState(false)

  if (settled && loaded && !stored) {
    const initial = toDraft(settings)
    setStored(initial)
    setDraft(initial)
  }

  // Typing something and then undoing it is not a change, so the button goes
  // quiet again rather than staying lit on an edit that no longer exists.
  const dirty = useMemo(
    () => Boolean(stored && draft && FIELDS.some(key => draft[key].trim() !== stored[key].trim())),
    [stored, draft]
  )

  const complete = Boolean(
    draft && NUMBER_FIELDS.every(key => parseWholeNumber(draft[key]) !== null)
  )

  if (!draft && settled && !loaded) {
    return (
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="text-[15px] text-mute">Settings could not be loaded.</p>
        <button onClick={() => void revalidate()} className="btn-quiet mt-4">Try again</button>
      </div>
    )
  }

  if (!draft) {
    return (
      <div className="mx-auto max-w-xl space-y-2" aria-busy="true" aria-label="Loading settings">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="h-14 animate-pulse rounded-sm bg-base-panel" />
        ))}
      </div>
    )
  }

  const bind = (key: Field) => ({
    value: draft[key],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setDraft(current => (current ? { ...current, [key]: e.target.value } : current)),
  })

  const save = async () => {
    setBusy(true)
    const numbers = Object.fromEntries(NUMBER_FIELDS.map(key => [key, parseWholeNumber(draft[key])]))
    const { error } = await supabase
      .from('settings')
      .update({ ...numbers, updated_at: new Date().toISOString() })
      .eq('id', true)
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    setStored(draft)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), SAVED_FEEDBACK_MS)
    push({ tone: 'good', title: 'Settings saved' })
    await revalidate()
  }

  return (
    <div className="mx-auto max-w-xl animate-rise">
      <h1 className="text-3xl lg:text-4xl">Settings</h1>
      <p className="mt-2 text-[15px] text-chalk-dim">These rules drive the whole system.</p>

      <div className="mt-7">
        <Accordion title="Gym" defaultOpen>
          <SettingField label="Registration fee">
            <input type="number" min="0" inputMode="numeric" {...bind('registration_fee')} className="field" />
          </SettingField>
        </Accordion>

        <Accordion title="Renewals">
          <SettingField label="Renewal notice (days)">
            <input type="number" min="1" inputMode="numeric" {...bind('expiry_notice_days')} className="field" />
          </SettingField>
        </Accordion>

        <Accordion title="Referrals">
          <SettingField label="Referrals needed">
            <input type="number" min="1" inputMode="numeric" {...bind('referral_target')} className="field" />
          </SettingField>
          <SettingField label="Reward (days)">
            <input type="number" min="1" inputMode="numeric" {...bind('referral_reward_days')} className="field" />
          </SettingField>
        </Accordion>

        <Accordion title="Check-in">
          <SettingField label="Repeat scan window (hours)">
            <input type="number" min="1" inputMode="numeric" {...bind('checkin_window_hours')} className="field" />
          </SettingField>
        </Accordion>

        <Accordion title="Notifications">
          <NotificationToggle />
        </Accordion>

        <Accordion title="Door sounds">
          <SoundPreview />
        </Accordion>
      </div>

      {dirty && !complete && (
        <p role="alert" className="mt-7 text-sm text-out">Every field needs a value. Numbers must be whole.</p>
      )}

      <button onClick={save} disabled={!dirty || !complete || busy} className="btn-primary mt-7 w-full">
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

function SettingField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-5 block last:mb-0">
      <span className="label">{label}</span>
      <span className="mt-1.5 block">{children}</span>
    </label>
  )
}
