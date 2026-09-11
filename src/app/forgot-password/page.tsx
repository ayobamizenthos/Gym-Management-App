'use client'

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setBusy(true)
    setError(null)
    const redirectTo = window.location.origin + '/reset-password'
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo })
    if (resetError) setError(resetError.message)
    else setSent(true)
    setBusy(false)
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <span className="font-display text-2xl uppercase tracking-tightest">
        Zenthos<span className="text-live">Gym</span>
      </span>
      <h1 className="mt-8 text-4xl">Reset password</h1>

      {sent ? (
        <p className="mt-4 border-l-2 border-live pl-3 text-sm">
          Check your inbox for the reset link.
        </p>
      ) : (
        <form onSubmit={submit} className="mt-6">
          <label className="block">
            <span className="text-xs uppercase tracking-[0.2em] text-mute">Email</span>
            <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="field mt-2" />
          </label>
          {error && <p className="mt-4 border-l-2 border-out pl-3 text-sm text-out">{error}</p>}
          <button type="submit" disabled={busy} className="btn-primary mt-6 w-full">
            {busy ? 'Sending' : 'Send reset link'}
          </button>
        </form>
      )}

      <Link href="/login" className="mt-6 text-sm text-mute underline-offset-4 hover:text-live hover:underline">
        Back to sign in
      </Link>
    </main>
  )
}
