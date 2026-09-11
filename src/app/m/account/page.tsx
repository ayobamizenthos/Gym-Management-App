'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Camera, LogOut, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import { useToasts } from '@/stores/toast'
import { AvatarCropper } from '@/components/AvatarCropper'
import { Avatar } from '@/components/Avatar'
import { forgetAvatar } from '@/lib/avatar'
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
  const [pending, setPending] = useState<File | null>(null)
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

  const upload = async (blob: Blob) => {
    if (!profile) return
    setPending(null)
    setUploading(true)
    try {
      const path = profile.id + '/avatar.jpg'
      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, blob, { upsert: true, contentType: 'image/jpeg' })
      if (error) throw error
      forgetAvatar(path)
      const { error: saveError } = await supabase.from('profiles').update({ photo_url: path }).eq('id', profile.id)
      if (saveError) throw saveError
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

  return (
    <div className="animate-rise pb-10">
      <h1 className="text-3xl">Account</h1>

      <section className="mt-6 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          aria-label="Change profile photo"
          className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-edge"
        >
          <Avatar path={profile.photo_url} name={profile.full_name} size={80} />
          <span className="absolute inset-x-0 bottom-0 grid place-items-center bg-base/70 py-1">
            <Camera size={13} className="text-white" aria-hidden />
          </span>
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
          <p className="truncate text-sm text-mute">{profile.email}</p>
          {uploading && <p className="text-xs text-live"><span className="dots">Uploading</span></p>}
        </div>
      </section>

      <div
        className={cn(
          'mt-6 flex items-center justify-between rounded-lg px-4 py-3.5',
          active ? 'bg-live-tint' : 'bg-out-tint'
        )}
      >
        <span className="text-[15px] font-medium">
          {profile.expires_at ? (active ? 'Active membership' : 'Membership expired') : 'No plan yet'}
        </span>
        <span className={cn('font-display text-lg', active ? 'text-live' : 'text-out')}>
          {profile.expires_at ? (active ? left + ' days left' : shortDate(profile.expires_at)) : '--'}
        </span>
      </div>

      <Link
        href="/m/history"
        className="mt-3 flex items-center justify-between rounded-lg border border-edge px-4 py-3.5 transition-colors hover:bg-base-panel"
      >
        <span className="text-[15px] font-medium">Payment history</span>
        <ChevronRight size={18} className="text-mute" aria-hidden />
      </Link>

      <section className="mt-8">
        <h2 className="text-xl">Your details</h2>
        <div className="mt-4 flex flex-col gap-4">
          <label className="block">
            <span className="text-sm font-medium text-mute">Full name</span>
            <input value={form.full_name} onChange={set('full_name')} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-mute">Phone</span>
            <input inputMode="tel" value={form.phone} onChange={set('phone')} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-mute">Address</span>
            <input value={form.address} onChange={set('address')} className="field mt-1.5" />
          </label>
          <label className="block">
            <span className="text-sm font-medium text-mute">Emergency contact</span>
            <input value={form.emergency_contact} onChange={set('emergency_contact')} className="field mt-1.5" />
          </label>
        </div>

        <button onClick={save} disabled={!dirty || busy} className="btn-primary mt-5 w-full">
          {saved ? 'Saved' : busy ? <span className="dots">Saving</span> : 'Save changes'}
        </button>
      </section>

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
