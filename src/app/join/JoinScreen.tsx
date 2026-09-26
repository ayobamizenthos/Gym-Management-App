'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { unlockAudio } from '@/lib/sounds'
import { PasswordField } from '@/components/PasswordField'
import { UsernameField } from '@/components/UsernameField'
import { useHydrated } from '@/hooks/useHydrated'
import { postJson } from '@/lib/post-json'
import { localDate } from '@/lib/format'

export default function JoinScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const referral = (params.get('ref') ?? '').trim().toLowerCase()
  const hydrated = useHydrated()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [dateOfBirth, setDateOfBirth] = useState('')
  const [username, setUsername] = useState('')
  const [usernameOk, setUsernameOk] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviter, setInviter] = useState<string | null>(null)

  useEffect(() => {
    if (!referral) return
    void supabase
      .rpc('inviter_name', { p_username: referral })
      .then(({ data }) => setInviter(typeof data === 'string' ? data : null))
  }, [referral])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    unlockAudio()
    // Created server side, already confirmed, so nobody waits on an email.
    const reply = await postJson<{ access_token?: string; refresh_token?: string }>('/api/join', {
      full_name: fullName,
      phone,
      email,
      address,
      date_of_birth: dateOfBirth,
      username,
      password,
      referral,
    })
    if (!reply.ok) {
      setError(reply.error)
      setBusy(false)
      return
    }

    const { access_token: accessToken, refresh_token: refreshToken } = reply.body
    if (!accessToken || !refreshToken) {
      router.replace('/login')
      return
    }
    await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
    router.replace('/m')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-5xl">Sign up</h1>
      {inviter && (
        <p className="mt-3 border-l-2 border-live pl-3 text-sm">
          <span className="text-live">{inviter}</span> invited you.
        </p>
      )}

      <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Full name</span>
          <input required value={fullName} onChange={e => setFullName(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Phone</span>
          <input required inputMode="tel" value={phone} onChange={e => setPhone(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Address</span>
          <input required value={address} onChange={e => setAddress(e.target.value)} className="field mt-2" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-[0.2em] text-mute">Date of birth</span>
          <input
            required
            type="date"
            max={localDate()}
            value={dateOfBirth}
            onChange={e => setDateOfBirth(e.target.value)}
            className="field mt-2"
          />
        </label>
        <UsernameField required value={username} onChange={setUsername} onStateChange={setUsernameOk} />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />

        {error && (
          <p role="alert" className="border-l-2 border-out pl-3 text-sm text-out">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !hydrated || !usernameOk} className="btn-primary mt-2 w-full">
          {busy ? <span className="dots">Creating account</span> : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-sm text-mute">
        Already a member?{' '}
        <Link href="/login" className="inline-flex min-h-[44px] items-center text-live underline-offset-4 hover:underline">
          Sign in
        </Link>
      </p>
    </main>
  )
}
