import { supabase } from './supabase'

// Member photos are personal data, so the bucket is private and every view is a
// short-lived signed URL. Signing costs a round trip, so results are cached for
// most of their lifetime rather than re-signed on every render.
const TTL_SECONDS = 3600
const cache = new Map<string, { url: string; expires: number }>()

export async function signedAvatar(path: string | null | undefined): Promise<string | null> {
  if (!path) return null
  // Older rows stored a full public URL; fall back to it rather than breaking.
  if (path.startsWith('http')) return path

  const hit = cache.get(path)
  if (hit && hit.expires > Date.now()) return hit.url

  const { data } = await supabase.storage.from('avatars').createSignedUrl(path, TTL_SECONDS)
  if (!data?.signedUrl) return null

  cache.set(path, { url: data.signedUrl, expires: Date.now() + (TTL_SECONDS - 120) * 1000 })
  return data.signedUrl
}

export function forgetAvatar(path: string | null | undefined) {
  if (path) cache.delete(path)
}
