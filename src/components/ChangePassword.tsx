'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { MIN_PASSWORD_LENGTH } from '@/lib/passwords'
import { useToasts } from '@/stores/toast'
import { PasswordField } from '@/components/PasswordField'

export function ChangePassword({ email }: { email: string }) {
  const push = useToasts(s => s.push)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    if (next.length < MIN_PASSWORD_LENGTH) {
      push({ tone: 'bad', title: 'Too short', message: 'Use at least ' + MIN_PASSWORD_LENGTH + ' characters.' })
      return
    }
    if (next !== confirm) {
      push({ tone: 'bad', title: 'Passwords differ', message: 'Type the same new password twice.' })
      return
    }
    setSaving(true)
    // the current password proves it is the owner holding the phone
    const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current })
    if (checkError) {
      setSaving(false)
      push({ tone: 'bad', title: 'Wrong password', message: 'Your current password is not correct.' })
      return
    }
    const { error } = await supabase.auth.updateUser({ password: next })
    setSaving(false)
    if (error) {
      push({ tone: 'bad', title: 'Not changed', message: 'Check your connection and try again.' })
      return
    }
    setCurrent('')
    setNext('')
    setConfirm('')
    push({ tone: 'good', title: 'Password changed' })
  }

  return (
    <form onSubmit={changePassword} className="mt-3 flex flex-col gap-4">
      <PasswordField label="Current password" value={current} onChange={setCurrent} autoComplete="current-password" />
      <PasswordField label="New password" value={next} onChange={setNext} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
      <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} />
      <button type="submit" disabled={saving} className="btn-quiet w-full">
        {saving ? <span className="dots">Saving</span> : 'Change password'}
      </button>
    </form>
  )
}
