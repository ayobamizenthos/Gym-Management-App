'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/lib/types'

interface AuthValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  role: Profile['role'] | null
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue>({
  session: null,
  profile: null,
  loading: true,
  role: null,
  refresh: async () => {},
  signOut: async () => {},
})

const PROFILE_CACHE = 'zg.profile'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // Show the cached profile immediately so a slow connection never blocks the
  // first paint; the live row replaces it as soon as it lands.
  useEffect(() => {
    try {
      const cached = localStorage.getItem(PROFILE_CACHE)
      if (cached) setProfile(JSON.parse(cached) as Profile)
    } catch {}
  }, [])

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null)
      try { localStorage.removeItem(PROFILE_CACHE) } catch {}
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (data) {
      setProfile(data as Profile)
      try { localStorage.setItem(PROFILE_CACHE, JSON.stringify(data)) } catch {}
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadProfile(data.session?.user.id)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next)
      await loadProfile(next?.user.id)
      setLoading(false)
    })
    return () => sub.subscription.unsubscribe()
  }, [loadProfile])

  const value = useMemo<AuthValue>(
    () => ({
      session,
      profile,
      loading,
      role: profile?.role ?? null,
      refresh: () => loadProfile(session?.user.id),
      signOut: async () => {
        await supabase.auth.signOut()
        try { localStorage.removeItem(PROFILE_CACHE) } catch {}
        setProfile(null)
      },
    }),
    [session, profile, loading, loadProfile]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => useContext(AuthContext)
