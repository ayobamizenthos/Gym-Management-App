'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { homeFor } from '@/lib/routes'
import { postJson, safeNext } from '@/lib/post-json'
import { unlockAudio } from '@/lib/sounds'
import { PasswordField } from '@/components/PasswordField'
import { AuthShell } from '@/components/AuthShell'
import { useHydrated } from '@/hooks/useHydrated'
import type { Role } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const [identifier, setIdentifier] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    unlockAudio()

    // An invite name cannot be turned into an email in the browser without
    // exposing the member list, so the grant happens on the server and the
    // session it hands back is installed here.
    const reply = await postJson<{ access_token: string; refresh_token: string }>('/api/signin', { identifier, password })
    if (!reply.ok) {
      setError(reply.error)
      setBusy(false)
      return
    }

    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: reply.body.access_token,
      refresh_token: reply.body.refresh_token,
    })
    if (sessionError || !data.user) {
      setError('Could not start your session. Try again.')
      setBusy(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .maybeSingle()
    // a member signed out at the door goes straight back to check in
    const next = safeNext(new URLSearchParams(window.location.search).get('next'))
    router.replace(next ?? homeFor((profile?.role ?? 'member') as Role))
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in to check in, train and keep your plan running.">
      <form onSubmit={submit} className="mt-8">
        <label className="block">
          <span className="label">Email or username</span>
          <input
            type="text"
            required
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode="email"
            value={identifier}
            onChange={e => setIdentifier(e.target.value)}
            className="field mt-1.5"
          />
        </label>

        <div className="mt-4">
          <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        <div className="mt-2 flex justify-end">
          <Link href="/forgot-password" className="inline-flex min-h-[44px] items-center text-[14px] font-medium text-mute hover:text-chalk">
            Forgot password?
          </Link>
        </div>

        {error && (
          <p role="alert" className="mt-2 rounded-sm bg-out-tint px-3 py-2.5 text-sm text-out">
            {error}
          </p>
        )}

        <button type="submit" disabled={busy || !hydrated} className="btn-primary mt-4 h-[52px] w-full">
          {busy ? <span className="dots">Signing in</span> : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-center text-[15px] text-mute">
        New here?{' '}
        <Link href="/join" className="font-semibold text-live">
          Create an account
        </Link>
      </p>
    </AuthShell>
  )
}
