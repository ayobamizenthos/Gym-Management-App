'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/stores/auth'
import { homeFor } from '@/lib/routes'
import { Loader } from '@/components/Loader'

export default function Gateway() {
  const { session, profile, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return
    router.replace(session ? homeFor(profile?.role) : '/login')
  }, [loading, session, profile?.role, router])

  return <Loader full />
}
