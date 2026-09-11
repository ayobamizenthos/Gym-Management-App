'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordPage() {
  const router = useRouter()
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
        Zenthos<span className="text-volt">Gym</span>
      </span>
      <h1 className="mt-8 text-4xl">New password</h1>

      {!ready ? (
        <p className="mt-4 text-sm text-ink-mute">Open this page from the link in your email.</p>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-ink-mute">Password</span>
            <input required type="password" minLength={8} value={password} onChange={e => setPassword(e.target.value)} className="field mt-2" />
          </label>
          {error && <p className="mt-4 border-l-2 border-alert pl-3 text-sm text-alert">{error}</p>}
          <button type="submit" disabled={busy} className="btn-volt mt-6 w-full">
            {busy ? 'Saving' : 'Save password'}
          </button>
        </form>
      )}
    </main>
  )
}
