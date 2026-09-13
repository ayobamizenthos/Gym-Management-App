'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { homeFor } from '@/lib/routes'
import { unlockAudio } from '@/lib/sounds'
import { PasswordField } from '@/components/PasswordField'
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
    const res = await fetch('/api/signin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })
    const payload = await res.json()
    if (!res.ok) {
      setError(payload.error)
      setBusy(false)
      return
    }

    const { data, error: sessionError } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
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
    router.replace(homeFor((profile?.role ?? 'member') as Role))
  }

  return (
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Desktop: the photograph is the statement, the copy sits on it. */}
      <section className="relative hidden lg:block">
        <Image src="/img/rack.jpg" alt="" fill priority sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover opacity-55" />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-tr from-base via-base/60 to-transparent" />
        <div className="relative flex h-full flex-col justify-between p-14">
          <span className="font-display text-2xl uppercase tracking-tightest">Zenthos Gym</span>
          <h1 className="max-w-[9ch] text-[6rem]">
            Show up<span className="text-live">.</span> Every day<span className="text-live">.</span>
          </h1>
        </div>
      </section>

      {/* Mobile: a photographic band keeps the gym in frame above the form. */}
      <section className="flex min-h-dvh flex-col lg:min-h-0">
        <div className="relative h-44 lg:hidden">
          <Image src="/img/rack.jpg" alt="" fill priority sizes="100vw" className="object-cover opacity-45" />
          <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-base/20" />
          <span className="absolute bottom-5 left-5 font-display text-3xl uppercase tracking-tightest">
            Zenthos Gym
          </span>
        </div>

        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <form onSubmit={submit} className="w-full max-w-sm animate-rise">
            <h2 className="text-4xl">Sign in</h2>

            <label className="mt-8 block">
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
                className="field mt-2"
              />
            </label>

            <div className="mt-4">
              <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
            </div>

            {error && (
              <p role="alert" className="mt-4 rounded-sm bg-out-tint px-3 py-2 text-sm text-out">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy || !hydrated} className="btn-primary mt-7 w-full">
              {busy ? <span className="dots">Signing in</span> : 'Sign in'}
            </button>

            <div className="mt-3 flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="inline-flex min-h-[44px] items-center text-mute underline-offset-4 hover:text-chalk hover:underline">
                Forgot password
              </Link>
              <Link href="/join" className="inline-flex min-h-[44px] items-center text-mute underline-offset-4 hover:text-chalk hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
