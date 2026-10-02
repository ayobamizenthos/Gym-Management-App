'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { unlockAudio } from '@/lib/sounds'
import { PasswordField } from '@/components/PasswordField'
import { AuthShell } from '@/components/AuthShell'
import { UsernameField } from '@/components/UsernameField'
import { useHydrated } from '@/hooks/useHydrated'
import { postJson } from '@/lib/post-json'

const INVITER_LOOKUP_DELAY_MS = 400

export default function JoinScreen() {
  const params = useSearchParams()
  const router = useRouter()
  const linked = (params.get('ref') ?? '').trim().toLowerCase()
  // without an invite link, the friend's username typed here counts the same
  const [typedInviter, setTypedInviter] = useState('')
  const referral = linked || typedInviter.trim().toLowerCase().replace(/^@/, '')
  const hydrated = useHydrated()

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [usernameOk, setUsernameOk] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [inviter, setInviter] = useState<string | null>(null)

  const [checked, setChecked] = useState('')

  useEffect(() => {
    if (!referral) {
      setInviter(null)
      setChecked('')
      return
    }
    const timer = window.setTimeout(() => {
      void supabase.rpc('inviter_name', { p_username: referral }).then(({ data }) => {
        setInviter(typeof data === 'string' ? data : null)
        setChecked(referral)
      })
    }, linked ? 0 : INVITER_LOOKUP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [referral, linked])

  const unknownInviter = !linked && referral !== '' && checked === referral && inviter === null

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
      username,
      password,
      referral: inviter ? referral : '',
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
    <AuthShell title="Join the gym" subtitle="Two minutes, then you can check in, follow workouts and track every lift.">
      {linked && inviter && (
        <div className="mt-6 flex items-center gap-3 rounded-lg bg-live-tint px-4 py-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-live font-display text-lg uppercase text-ink">
            {inviter.charAt(0)}
          </span>
          <p className="text-[14px] leading-snug">
            <span className="font-semibold text-live">{inviter}</span> invited you
          </p>
        </div>
      )}

      <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
        <label className="block">
          <span className="label">Full name</span>
          <input required autoComplete="name" value={fullName} onChange={e => setFullName(e.target.value)} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Phone</span>
          <input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} className="field mt-1.5" />
        </label>
        <label className="block">
          <span className="label">Email</span>
          <input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="field mt-1.5" />
        </label>
        <UsernameField required value={username} onChange={setUsername} onStateChange={setUsernameOk} />
        <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
        {!linked && (
          <label className="block">
            <span className="label">Invite code (optional)</span>
            <input
              value={typedInviter}
              onChange={e => setTypedInviter(e.target.value.slice(0, 30))}
              placeholder="@"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="field mt-1.5"
            />
            {inviter && <span className="mt-2 block text-sm text-live">Invited by {inviter}</span>}
            {unknownInviter && <span className="mt-2 block text-sm text-out">No member has that username.</span>}
          </label>
        )}

        {error && (
          <p role="alert" className="rounded-sm bg-out-tint px-3 py-2.5 text-sm text-out">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !hydrated || !usernameOk || unknownInviter} className="btn-primary mt-2 h-[52px] w-full">
          {busy ? <span className="dots">Creating account</span> : 'Create account'}
        </button>
      </form>

      <p className="mt-6 text-center text-[15px] text-mute">
        Already a member?{' '}
        <Link href="/login" className="font-semibold text-live">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
