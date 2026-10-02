'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut, ChevronRight, LayoutDashboard } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { AvatarCropper } from '@/components/AvatarCropper'
import { Avatar } from '@/components/Avatar'
import { forgetAvatar } from '@/lib/avatar'
import { asName, daysLeft, localDate, plural } from '@/lib/format'
import { cn } from '@/lib/cn'
import { isReachableEmail } from '@/lib/members'
import { NotificationToggle } from '@/components/NotificationToggle'
import { ChangePassword } from '@/components/ChangePassword'
import { InstallRow } from '@/components/InstallRow'
import { PhoneField } from '@/components/PhoneField'
import { FoldRow } from '@/components/FoldRow'

const SAVED_FEEDBACK_MS = 2000

interface Props {
  /** Staff open their account from inside the dashboard, where membership,
   *  payment history and the alerts switch already live elsewhere. */
  workspace: 'member' | 'staff'
}

export function AccountScreen({ workspace }: Props) {
  const { profile, refresh, signOut } = useAuth()
  const router = useRouter()
  const push = useToasts(s => s.push)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ phone: '', address: '', date_of_birth: '', emergency_contact: '' })
  const [formFor, setFormFor] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pending, setPending] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  // Filled once per account; a background profile refresh must not wipe what is being typed.
  if (profile && formFor !== profile.id) {
    setFormFor(profile.id)
    setForm({
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      date_of_birth: profile.date_of_birth ?? '',
      emergency_contact: profile.emergency_contact ?? '',
    })
  }

  const edit = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value })
    setDirty(true)
  }

  const save = async () => {
    if (!profile) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update({ ...form, date_of_birth: form.date_of_birth || null }).eq('id', profile.id)
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), SAVED_FEEDBACK_MS)
    await refresh()
  }

  const upload = async (blob: Blob) => {
    if (!profile) return
    setPending(null)
    setUploading(true)
    try {
      // A fresh name per upload. Reusing one path lets every phone and the
      // storage CDN keep serving the old picture from cache.
      const previous = profile.photo_url
      const path = profile.id + '/avatar-' + Date.now() + '.jpg'
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      const { error: saveError } = await supabase.from('profiles').update({ photo_url: path }).eq('id', profile.id)
      if (saveError) throw saveError
      if (previous && previous !== path && previous.startsWith(profile.id + '/')) {
        forgetAvatar(previous)
        void supabase.storage.from('avatars').remove([previous])
      }
      await refresh()
      push({ tone: 'good', title: 'Photo updated' })
    } catch (e) {
      push({ tone: 'bad', title: 'Upload failed', message: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  if (!profile) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading your account">
        <div className="h-9 w-32 animate-pulse rounded-sm bg-base-panel" />
        <div className="h-20 animate-pulse rounded-sm bg-base-panel" />
        <div className="h-14 animate-pulse rounded-sm bg-base-panel" />
        <div className="h-56 animate-pulse rounded-sm bg-base-panel" />
      </div>
    )
  }

  const left = daysLeft(profile.expires_at)
  const active = left !== null && left > 0
  const staff = profile.role === 'admin' || profile.role === 'receptionist'
  const inMemberArea = workspace === 'member'

  return (
    <div className={cn('animate-rise pb-10', !inMemberArea && 'mx-auto max-w-xl')}>
      <h1 className="text-3xl">Account</h1>

      <section className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-edge"
        >
          <Avatar path={profile.photo_url} name={profile.full_name} size={80} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) setPending(file)
            e.target.value = ''
          }}
        />
        <div className="min-w-0">
          <p className="truncate text-xl font-semibold">{profile.full_name ?? 'Member'}</p>
          <p className="truncate text-sm text-mute">
            {isReachableEmail(profile.email) ? profile.email : profile.phone ?? 'Member'}
          </p>
          {uploading && <p className="text-sm text-live"><span className="dots">Uploading</span></p>}
        </div>
      </section>

      {!inMemberArea ? null : active ? (
        <div className="mt-6 flex items-center justify-between gap-3 rounded-lg bg-live-tint px-4 py-3.5">
          <span className="text-[15px] font-medium">Active membership</span>
          <span className="shrink-0 font-display text-lg text-live">{left} {plural(left ?? 0, 'day')} left</span>
        </div>
      ) : (
        <Link
          href="/m/renew"
          className={cn(
            'mt-6 flex items-center justify-between gap-3 rounded-lg px-4 py-3.5 transition-colors hover:bg-base-raised',
            profile.expires_at ? 'bg-out-tint' : 'bg-base-panel'
          )}
        >
          <span className="text-[15px] font-medium">
            {profile.expires_at ? 'Membership expired' : 'No plan yet'}
          </span>
          <span className="flex shrink-0 items-center gap-1 font-display text-lg uppercase tracking-tightest text-mute">
            Choose a plan <ChevronRight size={17} aria-hidden />
          </span>
        </Link>
      )}

      {inMemberArea && staff && (
        <Link
          href={profile.role === 'admin' ? '/admin' : '/desk'}
          className="row mt-3 justify-between"
        >
          <span className="flex items-center gap-2.5 text-[15px] font-medium">
            <LayoutDashboard size={18} className="text-live" aria-hidden />
            Back to {profile.role === 'admin' ? 'admin dashboard' : 'front desk'}
          </span>
          <ChevronRight size={18} className="text-live" aria-hidden />
        </Link>
      )}

      {inMemberArea && (
        <Link
          href="/m/history"
          className="row mt-3 justify-between"
        >
          <span className="text-[15px] font-medium">Payment history</span>
          <ChevronRight size={18} className="text-mute" aria-hidden />
        </Link>
      )}

      <section className="mt-8">
        <h2 className="text-xl">Your details</h2>

        <dl className="mt-4 divide-y divide-edge-soft rounded-lg bg-base-panel px-4">
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="label shrink-0">Name</dt>
            <dd className="truncate text-right text-[15px]">{profile.full_name ?? '--'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="label shrink-0">Email</dt>
            <dd className="truncate text-right text-[15px]">
              {isReachableEmail(profile.email) ? profile.email : 'None on file'}
            </dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt className="label shrink-0">Username</dt>
            <dd className="truncate text-right text-[15px]">
              {profile.username ? (
                asName(profile.username)
              ) : inMemberArea ? (
                <Link href="/m/referrals" className="text-live underline-offset-4 hover:underline">Pick one</Link>
              ) : (
                '--'
              )}
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <PhoneField
            label="Phone"
            value={form.phone}
            onChange={phone => {
              setForm({ ...form, phone })
              setDirty(true)
            }}
          />
        </div>

        <FoldRow title="Additional information" className="mt-4">
          <div className="flex flex-col gap-4">
            <label className="block">
              <span className="label">Address</span>
              <input value={form.address} onChange={edit('address')} autoComplete="street-address" className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Date of birth</span>
              <input type="date" max={localDate()} value={form.date_of_birth} onChange={edit('date_of_birth')} className="field mt-1.5" />
            </label>
            <label className="block">
              <span className="label">Emergency contact</span>
              <input value={form.emergency_contact} onChange={edit('emergency_contact')} placeholder="Name and phone" className="field mt-1.5" />
            </label>
          </div>
        </FoldRow>

        <button onClick={save} disabled={!dirty || busy} className="btn-primary mt-5 w-full">
          {saved ? 'Saved' : busy ? <span className="dots">Saving</span> : 'Save changes'}
        </button>
      </section>

      {/* staff switch alerts on and off from More, so there is only ever one switch */}
      {!staff && (
        <section className="mt-8">
          <h2 className="text-xl">Alerts</h2>
          <div className="mt-3 rounded-lg bg-base-panel px-4">
            <NotificationToggle />
          </div>
        </section>
      )}

      {profile.email && (
        <FoldRow title="Change password" className="mt-8">
          <ChangePassword email={profile.email} />
        </FoldRow>
      )}

      <InstallRow />

      <button
        onClick={async () => {
          await signOut()
          router.replace('/login')
        }}
        className="mt-9 flex w-full items-center justify-center gap-2 py-3 text-[15px] font-semibold text-out"
      >
        <LogOut size={17} aria-hidden /> Sign out
      </button>

      {pending && (
        <AvatarCropper file={pending} onCancel={() => setPending(null)} onDone={blob => void upload(blob)} />
      )}
    </div>
  )
}
