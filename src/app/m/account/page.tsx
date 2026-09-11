'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Camera, LogOut, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { daysLeft, shortDate } from '@/lib/format'
import { cn } from '@/lib/cn'

export default function AccountPage() {
  const { profile, refresh, signOut } = useAuth()
  const router = useRouter()
  const push = useToasts(s => s.push)
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({ full_name: '', phone: '', address: '', emergency_contact: '' })
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    if (!profile) return
    setForm({
      full_name: profile.full_name ?? '',
      phone: profile.phone ?? '',
      address: profile.address ?? '',
      emergency_contact: profile.emergency_contact ?? '',
    })
  }, [profile])

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: e.target.value })
    setDirty(true)
  }

  const save = async () => {
    if (!profile) return
    setBusy(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', profile.id)
    setBusy(false)
    if (error) {
      push({ tone: 'bad', title: 'Not saved', message: error.message })
      return
    }
    setDirty(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
    await refresh()
  }

  const pickPhoto = async (file: File) => {
    if (!profile) return
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg'
      const path = profile.id + '/avatar.' + ext
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      const url = data.publicUrl + '?v=' + Date.now()
      const { error: saveError } = await supabase.from('profiles').update({ photo_url: url }).eq('id', profile.id)
      if (saveError) throw saveError
      await refresh()
      push({ tone: 'good', title: 'Photo updated' })
    } catch (e) {
      push({ tone: 'bad', title: 'Upload failed', message: (e as Error).message })
    } finally {
      setUploading(false)
    }
  }

  const left = daysLeft(profile?.expires_at ?? null)
  const active = left !== null && left > 0

  return (
    <div className="animate-rise pb-8">
      <h1 className="text-4xl">Account</h1>

      <section className="mt-7 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
          className="relative grid h-20 w-20 shrink-0 place-items-center overflow-hidden border border-ink-line bg-ink-soft"
        >
          {profile?.photo_url ? (
            <Image src={profile.photo_url} alt="" fill sizes="80px" className="object-cover" unoptimized />
          ) : (
            <span className="font-display text-3xl uppercase text-ink-mute">
              {(profile?.full_name ?? 'M').charAt(0)}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-ink/80 py-1">
            <Camera size={13} className="text-volt" aria-hidden />
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0]
            if (file) void pickPhoto(file)
          }}
        />
        <div className="min-w-0">
          <p className="truncate font-display text-2xl uppercase tracking-tightest">
            {profile?.full_name ?? 'Member'}
          </p>
          <p className="truncate text-sm text-ink-mute">{profile?.member_code}</p>
          {uploading && <p className="text-xs text-volt">Uploading</p>}
        </div>
      </section>

      <dl className="mt-8 divide-y divide-ink-line border-y border-ink-line">
        <div className="flex items-baseline justify-between py-3.5">
          <dt className="text-xs uppercase tracking-[0.2em] text-ink-mute">Membership</dt>
          <dd className={cn('font-display text-xl', active ? 'text-volt' : 'text-alert')}>
            {profile?.expires_at ? (active ? left + ' days left' : 'Expired') : 'No plan'}
          </dd>
        </div>
        {profile?.expires_at && (
          <div className="flex items-baseline justify-between py-3.5">
            <dt className="text-xs uppercase tracking-[0.2em] text-ink-mute">Runs to</dt>
            <dd className="text-sm">{shortDate(profile.expires_at)}</dd>
          </div>
        )}
        <div className="flex items-baseline justify-between py-3.5">
          <dt className="text-xs uppercase tracking-[0.2em] text-ink-mute">Email</dt>
          <dd className="truncate pl-4 text-sm">{profile?.email ?? '--'}</dd>
        </div>
        <div className="flex items-baseline justify-between py-3.5">
          <dt className="text-xs uppercase tracking-[0.2em] text-ink-mute">Joined</dt>
          <dd className="text-sm">{shortDate(profile?.created_at ?? null)}</dd>
        </div>
      </dl>

      <Link href="/m/history" className="btn-ghost mt-6 w-full">Payment history</Link>

      <section className="mt-8">
        <h2 className="text-2xl">Your details</h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Full name</span>
            <input value={form.full_name} onChange={set('full_name')} className="field mt-2" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Phone</span>
            <input inputMode="tel" value={form.phone} onChange={set('phone')} className="field mt-2" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Address</span>
            <input value={form.address} onChange={set('address')} className="field mt-2" />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Emergency contact</span>
            <input value={form.emergency_contact} onChange={set('emergency_contact')} className="field mt-2" />
          </label>
        </div>

        <button onClick={save} disabled={!dirty || busy} className="btn-volt mt-6 w-full">
          {saved ? 'Saved' : busy ? 'Saving' : 'Save changes'}
        </button>
      </section>

      <button
        onClick={async () => {
          await signOut()
          router.replace('/login')
        }}
        className="mt-10 flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold uppercase tracking-wide text-alert"
      >
        <LogOut size={17} aria-hidden /> Sign out
      </button>
    </div>
  )
}
