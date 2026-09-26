'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'
import { useLatest } from '@/hooks/useLatest'

interface Snapshot {
  value: unknown
  settled: boolean
}

const STORAGE_PREFIX = 'zg:'
const EMPTY: Snapshot = { value: null, settled: false }

const snapshots = new Map<string, Snapshot>()
const inflight = new Map<string, Promise<void>>()
const listeners = new Map<string, Set<() => void>>()

function snapshotOf(key: string): Snapshot {
  const held = snapshots.get(key)
  if (held) return held
  let restored = EMPTY
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + key)
    if (raw) restored = { value: (JSON.parse(raw) as { value: unknown }).value, settled: false }
  } catch {
    // unreadable storage is the same as an empty one
  }
  snapshots.set(key, restored)
  return restored
}

function publish(key: string, next: Snapshot) {
  snapshots.set(key, next)
  listeners.get(key)?.forEach(listener => listener())
}

function subscribe(key: string, listener: () => void) {
  const group = listeners.get(key) ?? new Set()
  group.add(listener)
  listeners.set(key, group)
  return () => {
    group.delete(listener)
  }
}

function fetchInto(key: string, fetcher: () => Promise<unknown>): Promise<void> {
  const running = inflight.get(key)
  if (running) return running
  const request = fetcher()
    .then(value => {
      publish(key, { value, settled: true })
      try {
        window.localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify({ value }))
      } catch {
        // storage full or blocked; the in-memory copy still serves this session
      }
    })
    .catch(() => {
      // keep showing the last good copy
      publish(key, { ...snapshotOf(key), settled: true })
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, request)
  return request
}

/**
 * Stale-while-revalidate for reference data. Whatever was last fetched paints
 * first and every mount refreshes it in the background. Components reading the
 * same key share one copy and one request.
 */
export function useCached<T>(key: string, fetcher: () => Promise<T>) {
  const fetcherRef = useLatest(fetcher)

  const snapshot = useSyncExternalStore(
    useCallback(listener => subscribe(key, listener), [key]),
    () => snapshotOf(key),
    () => EMPTY
  )

  const revalidate = useCallback(() => fetchInto(key, () => fetcherRef.current()), [key, fetcherRef])

  useEffect(() => {
    void revalidate()
  }, [revalidate])

  const data = snapshot.value as T | null
  return { data, loading: data === null && !snapshot.settled, settled: snapshot.settled, revalidate }
}
