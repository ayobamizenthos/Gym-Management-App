'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { homeFor } from '@/lib/routes'
import { unlockAudio } from '@/lib/sounds'
import { PasswordField } from '@/components/PasswordField'
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
    unlockAudio()

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
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_1fr]">
      <section className="relative hidden overflow-hidden bg-surface-raised lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.05]"
          style={{ backgroundImage: 'repeating-linear-gradient(90deg,#fff 0 1px,transparent 1px 64px)' }}
        />
        <div className="relative flex h-full flex-col justify-between p-14">
          <span className="font-display text-2xl uppercase tracking-tightest">
            Zenthos<span className="text-good">Gym</span>
          </span>
          <h1 className="text-[5.5rem] leading-[0.84]">
            Know who<br />is paid.<br />
            <span className="text-good">Know who left.</span>
          </h1>
          <span className="text-xs uppercase tracking-[0.3em] text-mute">Lagos</span>
        </div>
      </section>

      <section className="flex items-center justify-center px-6 py-14">
        <form onSubmit={submit} className="w-full max-w-sm animate-rise">
          <span className="font-display text-2xl uppercase tracking-tightest lg:hidden">
            Zenthos<span className="text-good">Gym</span>
          </span>
          <h2 className="mt-10 text-4xl lg:mt-0">Sign in</h2>

          <label className="mt-8 block">
            <span className="text-xs uppercase tracking-[0.2em] text-mute">Email</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field mt-2"
            />
          </label>

          <div className="mt-4">
            <PasswordField label="Password" value={password} onChange={setPassword} autoComplete="current-password" />
          </div>

          {error && (
            <p role="alert" className="mt-4 border-l-2 border-alert pl-3 text-sm text-alert">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn-primary mt-7 w-full">
            {busy ? 'Signing in' : 'Sign in'}
          </button>

          <div className="mt-5 flex items-center justify-between text-sm">
            <Link href="/forgot-password" className="text-mute underline-offset-4 hover:text-good hover:underline">
              Forgot password
            </Link>
            <Link href="/join" className="text-mute underline-offset-4 hover:text-good hover:underline">
              Sign up
            </Link>
          </div>
        </form>
      </section>
    </main>
  )
}
