'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { homeFor } from '@/lib/routes'
import { unlockAudio } from '@/lib/sounds'
import type { Role } from '@/lib/types'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    unlockAudio() // first gesture - lets check-in audio fire later without a prompt

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (authError) {
      setError(authError.message)
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
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Statement panel - asymmetric on purpose, not a centred card */}
      <section className="relative hidden overflow-hidden bg-ink-soft lg:block">
        <div className="absolute inset-0 opacity-[0.06]"
             style={{ backgroundImage: 'repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 56px)' }} />
        <div className="relative flex h-full flex-col justify-between p-14">
          <span className="font-display text-2xl uppercase tracking-tightest">
            Zenthos<span className="text-volt">Gym</span>
          </span>
          <div>
            <h1 className="text-[5.5rem] leading-[0.85]">
              Know who<br />is paid.<br /><span className="text-volt">Know who left.</span>
            </h1>
            <p className="mt-8 max-w-md text-ink-mute">
              Memberships, check-in and renewals in one system. Built for gyms that
              are done guessing.
            </p>
          </div>
          <span className="text-xs uppercase tracking-[0.3em] text-ink-mute">Lagos, Nigeria</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise">
          <span className="font-display text-2xl uppercase tracking-tightest lg:hidden">
            Zenthos<span className="text-volt">Gym</span>
          </span>
          <h2 className="mt-8 text-4xl lg:mt-0">Sign in</h2>
          <p className="mt-2 text-sm text-ink-mute">Members, front desk and management use this same page.</p>

          <label className="mt-8 block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field mt-2"
              placeholder="you@example.com"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Password</span>
            <input
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="field mt-2"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="mt-4 border-l-2 border-alert pl-3 text-sm text-alert">{error}</p>}

          <button type="submit" disabled={busy} className="btn-volt mt-7 w-full">
            {busy ? 'Signing in' : 'Sign in'}
          </button>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-ink-mute underline-offset-4 hover:text-volt hover:underline">
              Forgot password
            </Link>
            <Link href="/join" className="text-ink-mute underline-offset-4 hover:text-volt hover:underline">
              Join the gym
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}
