'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { unlockAudio } from '@/lib/sounds'

export default function JoinScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const referral = (params.get('ref') ?? '').trim().toLowerCase()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviter, setInviter] = useState<string | null>(null)

  useEffect(() => {
    if (!referral) return
    void supabase
      .from('profiles')
      .select('full_name')
      .eq('username', referral)
      .maybeSingle()
      .then(({ data }) => setInviter((data?.full_name as string) ?? null))
  }, [referral])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    unlockAudio()
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          phone: phone.trim(),
          username: username.trim().toLowerCase(),
          referral,
        },
      },
    })
    if (signUpError) {
      setError(signUpError.message)
      setBusy(false)
      return
    }
    router.replace('/m')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <span className="font-display text-2xl uppercase tracking-tightest">
        Zenthos<span className="text-volt">Gym</span>
      </span>

      <h1 className="mt-8 text-5xl">Join the gym</h1>
      {inviter && (
        <p className="mt-3 border-l-2 border-volt pl-3 text-sm">
          <span className="text-volt">{inviter}</span> invited you.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Full name</span>
          <input required value={fullName} onChange={e => setFullName(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Phone</span>
          <input required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Your invite name</span>
          <input
            required
            value={username}
            onChange={e => setUsername(e.target.value)}
            pattern="[A-Za-z0-9_]{3,20}"
            placeholder="yourname"
            className="field mt-2"
          />
          <span className="mt-1 block text-xs text-ink-mute">Used for your own referral link.</span>
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Password</span>
          <input required type="password" minLength={8} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="field mt-2" />
        </label>

        {error && <p className="border-l-2 border-alert pl-3 text-sm text-alert">{error}</p>}

        <button type="submit" disabled={busy} className="btn-volt mt-2 w-full">
          {busy ? 'Creating' : 'Create my account'}
        </button>
      </form>

      <p className="mt-6 text-sm text-ink-mute">
        Already a member{' '}
        <Link href="/login" className="text-volt underline-offset-4 hover:underline">Sign in</Link>
      </p>
    </main>
  )
}
