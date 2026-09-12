'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PasswordField } from '@/components/PasswordField'
import { useHydrated } from '@/hooks/useHydrated'

export default function ResetPasswordPage() {
  const router = useRouter()
  const hydrated = useHydrated()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)))
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    if (updateError) {
      setError(updateError.message)
      setBusy(false)
      return
    }
    router.replace('/')
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <span className="font-display text-2xl uppercase tracking-tightest">
        Zenthos<span className="text-live">Gym</span>
      </span>
      <h1 className="mt-8 text-4xl">New password</h1>

      {!ready ? (
        <p className="mt-4 text-sm text-mute">Open this page from the link in your email.</p>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <PasswordField label="New password" value={password} onChange={setPassword} autoComplete="new-password" minLength={8} />
          {error && <p className="mt-4 border-l-2 border-out pl-3 text-sm text-out">{error}</p>}
          <button type="submit" disabled={busy || !hydrated} className="btn-primary mt-6 w-full">
            {busy ? <span className="dots">Saving</span> : 'Save password'}
          </button>
        </form>
      )}
    </main>
  )
}
