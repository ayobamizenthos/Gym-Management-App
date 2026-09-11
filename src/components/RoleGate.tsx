'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/auth'
import { homeFor } from '@/lib/routes'
import { Loader } from '@/components/Loader'
import type { Role } from '@/lib/types'

/** Client-side convenience only. Real enforcement lives in RLS. */
export function RoleGate({ allow, children }: { allow: Role[]; children: React.ReactNode }) {
  const { session, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    if (!session) { router.replace('/login'); return }
    if (profile && !allow.includes(profile.role)) router.replace(homeFor(profile.role))
  }, [loading, session, profile, allow, router])

  if (loading || !session || !profile) return <Loader full />
  if (!allow.includes(profile.role)) return <Loader full />
  return <>{children}</>
}
