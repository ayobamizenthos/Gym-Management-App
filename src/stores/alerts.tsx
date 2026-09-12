'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/stores/auth'
import type { Notification } from '@/lib/notifications'

interface AlertsValue {
  items: Notification[]
  unread: number
  loading: boolean
  markRead: (ids?: string[]) => Promise<void>
  clearAll: () => Promise<void>
  refresh: () => Promise<void>
}

const AlertsContext = createContext<AlertsValue>({
  items: [],
  unread: 0,
  loading: true,
  markRead: async () => {},
  clearAll: async () => {},
  refresh: async () => {},
})

const CACHE = 'zg.alerts'

/**
 * One subscription for the whole session. The bell badge, the inbox and the
 * toast watcher all read from here, so a notification is fetched once and the
 * unread count can never disagree with the list.
 */
export function AlertsProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [items, setItems] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  // the badge should be right on the first paint, before the network answers
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE)
      if (cached) setItems(JSON.parse(cached) as Notification[])
    } catch {}
  }, [])

  const store = useCallback((next: Notification[]) => {
    setItems(next)
    try {
      localStorage.setItem(CACHE, JSON.stringify(next.slice(0, 50)))
    } catch {}
  }, [])

  const refresh = useCallback(async () => {
    if (!session?.user.id) return
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(200)
    store((data ?? []) as Notification[])
    setLoading(false)
  }, [session?.user.id, store])

  useEffect(() => {
    if (!session?.user.id) {
      setItems([])
      setLoading(false)
      try { localStorage.removeItem(CACHE) } catch {}
      return
    }
    void refresh()

    const channel = supabase
      .channel('inbox:' + session.user.id)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: 'user_id=eq.' + session.user.id },
        () => void refresh()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [session?.user.id, refresh])

  const markRead = useCallback(async (ids?: string[]) => {
    // paint it read straight away; a slow connection must not make the tap feel dead
    setItems(current => {
      const next = current.map(n => (!ids || ids.includes(n.id) ? { ...n, is_read: true } : n))
      try { localStorage.setItem(CACHE, JSON.stringify(next.slice(0, 50))) } catch {}
      return next
    })
    await supabase.rpc('mark_notifications_read', { p_ids: ids ?? null })
  }, [])

  const clearAll = useCallback(async () => {
    store([])
    await supabase.from('notifications').delete().not('id', 'is', null)
  }, [store])

  const value = useMemo<AlertsValue>(
    () => ({ items, unread: items.filter(n => !n.is_read).length, loading, markRead, clearAll, refresh }),
    [items, loading, markRead, clearAll, refresh]
  )

  return <AlertsContext.Provider value={value}>{children}</AlertsContext.Provider>
}

export const useAlerts = () => useContext(AlertsContext)
