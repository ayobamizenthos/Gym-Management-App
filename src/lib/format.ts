export const naira = (value: number | string) =>
  '\u20A6' + Number(value).toLocaleString('en-NG', { maximumFractionDigits: 0 })

export const shortDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : '--'

export const timeOnly = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })

export function daysLeft(expiresAt: string | null): number | null {
  if (!expiresAt) return null
  const ms = new Date(expiresAt).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

/** Usernames are stored lowercase because they live in URLs; they are shown
 *  with a capital because they are how a member is addressed. */
export const asName = (username: string | null | undefined) =>
  username ? username.charAt(0).toUpperCase() + username.slice(1) : null
