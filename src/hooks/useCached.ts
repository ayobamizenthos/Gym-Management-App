'use client'

import { useCallback, useEffect, useState } from 'react'

const MEMORY = new Map<string, unknown>()

/**
 * Stale-while-revalidate for reference data.
 *
 * On a slow connection the difference between "renders instantly from what we
 * already know" and "spinner for two seconds" is the whole feel of the app, so
 * cached data paints first and the network result swaps in behind it. Memory is
 * checked before storage so repeat navigations cost nothing at all.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T>, ttlMs = 5 * 60 * 1000) {
  const [data, setData] = useState<T | null>(() => {
    if (MEMORY.has(key)) return MEMORY.get(key) as T
    if (typeof window === 'undefined') return null
    try {
      const raw = window.localStorage.getItem('zg:' + key)
      if (!raw) return null
      const parsed = JSON.parse(raw) as { at: number; value: T }
      MEMORY.set(key, parsed.value)
      return parsed.value
    } catch {
      return null
    }
  })
  const [loading, setLoading] = useState(data === null)

  const revalidate = useCallback(async () => {
    try {
      const fresh = await fetcher()
      setData(fresh)
      MEMORY.set(key, fresh)
      try {
        window.localStorage.setItem('zg:' + key, JSON.stringify({ at: Date.now(), value: fresh }))
      } catch {
        // storage full or blocked - the memory cache still holds
      }
    } finally {
      setLoading(false)
    }
    // fetcher identity is intentionally not tracked; the key defines the data
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  useEffect(() => {
    let fresh = false
    try {
      const raw = window.localStorage.getItem('zg:' + key)
      if (raw) {
        const parsed = JSON.parse(raw) as { at: number }
        fresh = Date.now() - parsed.at < ttlMs
      }
    } catch {
      fresh = false
    }
    // Always revalidate, but only block the UI when we have nothing to show.
    if (!fresh || data === null) void revalidate()
    else void revalidate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return { data, loading: loading && data === null, revalidate }
}
