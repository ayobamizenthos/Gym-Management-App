'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/auth'
import { homeFor } from '@/lib/routes'
import { Loader } from '@/components/Loader'
import type { Role } from '@/lib/types'

/** Client-side convenience only. Real enforcement lives in RLS. */
export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { session, profile, loading, refresh, signOut } = useAuth()
  const router = useRouter()
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    if (loading) return
    if (!session) { router.replace('/login'); return }
    if (profile && !allow.includes(profile.role)) router.replace(homeFor(profile.role))
  }, [loading, session, profile, allow, router])

  const retry = async () => {
    setRetrying(true)
    await refresh()
    setRetrying(false)
  }

  const leave = async () => {
    await signOut()
    router.replace('/login')
  }

  if (!loading && session && !profile && !retrying) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6 text-center">
        <h1 className="text-3xl">Account not loaded</h1>
        <p className="mt-3 text-[15px] text-chalk-dim">Check your connection, then try again.</p>
        <button onClick={() => void retry()} className="btn-primary mt-6 w-full">Try again</button>
        <button onClick={() => void leave()} className="btn-quiet mt-2.5 w-full">Sign out</button>
      </main>
    )
  }

  if (loading || !session || !profile) return <Loader full />
  if (!allow.includes(profile.role)) return <Loader full />
  return <>{children}</>
}
