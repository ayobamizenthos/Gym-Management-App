'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
    <main className="min-h-dvh lg:grid lg:grid-cols-[1.1fr_1fr]">
      {/* Desktop: the photograph is the statement, the copy sits on it. */}
      <section className="relative hidden lg:block">
        <Image src="/img/rack.jpg" alt="" fill priority sizes="55vw" className="object-cover opacity-55" />
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
              <span className="label">Email</span>
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
              <p role="alert" className="mt-4 rounded-sm bg-out-tint px-3 py-2 text-sm text-out">
                {error}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary mt-7 w-full">
              {busy ? 'Signing in' : 'Sign in'}
            </button>

            <div className="mt-5 flex items-center justify-between text-sm">
              <Link href="/forgot-password" className="text-mute underline-offset-4 hover:text-chalk hover:underline">
                Forgot password
              </Link>
              <Link href="/join" className="text-mute underline-offset-4 hover:text-chalk hover:underline">
                Sign up
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
