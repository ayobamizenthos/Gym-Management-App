import { supabase } from './supabase'

// Member photos are personal data, so the bucket is private and every view is a
// short-lived signed URL. Signing costs a round trip, so results are cached for
// most of their lifetime rather than re-signed on every render.
const TTL_SECONDS = 3600
const cache = new Map<string, { url: string; expires: number }>()

// A members list mounts hundreds of avatars in one frame. Requests made in the
// same tick are signed together in a single call instead of one each.
let queued = new Map<string, ((url: string | null) => void)[]>()
let flushScheduled = false

async function flush() {
  const batch = queued
  queued = new Map()
  flushScheduled = false

  const paths = [...batch.keys()]
  const { data } = await supabase.storage.from('avatars').createSignedUrls(paths, TTL_SECONDS)
  const signed = new Map((data ?? []).map(entry => [entry.path, entry.signedUrl]))

  batch.forEach((waiting, path) => {
    const url = signed.get(path) || null
    if (url) cache.set(path, { url, expires: Date.now() + (TTL_SECONDS - 120) * 1000 })
    waiting.forEach(resolve => resolve(url))
  })
}

export function signedAvatar(path: string | null | undefined): Promise<string | null> {
  if (!path) return Promise.resolve(null)
  // Older rows stored a full public URL; fall back to it rather than breaking.
  if (path.startsWith('http')) return Promise.resolve(path)

  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url)

  return new Promise(resolve => {
    queued.set(path, [...(queued.get(path) ?? []), resolve])
    if (!flushScheduled) {
      flushScheduled = true
      queueMicrotask(() => void flush())
    }
  })
}

export function forgetAvatar(path: string | null | undefined) {
  if (path) cache.delete(path)
}
