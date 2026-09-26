'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { forgetDevice } from '@/lib/push'
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

  // The account the latest auth event belongs to; a profile load that finishes
  // after a sign out or account switch is dropped rather than written back.
  const currentUser = useRef<string | undefined>(undefined)

  const loadProfile = useCallback(async (userId: string | undefined) => {
    currentUser.current = userId
    if (!userId) {
      setProfile(null)
      try { localStorage.removeItem(PROFILE_CACHE) } catch {}
      return
    }
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (!data || currentUser.current !== userId) return
    setProfile(data as Profile)
    try { localStorage.setItem(PROFILE_CACHE, JSON.stringify(data)) } catch {}
  }, [])

  useEffect(() => {
    // The callback stays synchronous: awaiting Supabase inside it can deadlock
    // the client, so the profile load is scheduled after it returns.
    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next)
      if (event === 'TOKEN_REFRESHED' && next?.user.id === currentUser.current) return
      window.setTimeout(() => {
        void loadProfile(next?.user.id).finally(() => setLoading(false))
      }, 0)
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
        await forgetDevice().catch(() => {})
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
