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

export const plural = (count: number, one: string, many = one + 's') => (count === 1 ? one : many)

/** A non-negative whole number typed into a field, or null when the field is empty or malformed. */
export const parseWholeNumber = (text: string): number | null =>
  /^\d+$/.test(text.trim()) ? Number(text.trim()) : null

/** Today's calendar date on this device, as YYYY-MM-DD for date inputs. */
export const localDate = (at = new Date()) =>
  [at.getFullYear(), String(at.getMonth() + 1).padStart(2, '0'), String(at.getDate()).padStart(2, '0')].join('-')

/** The number after +234, without the trunk 0: "08031245567" and "+2348031245567" both give "8031245567". */
export const localPhone = (phone: string | null | undefined) => {
  const digits = (phone ?? '').replace(/\D/g, '')
  return digits.startsWith('234') ? digits.slice(3) : digits.replace(/^0/, '')
}

export const fullPhone = (local: string) => (local.trim() ? '+234' + local.replace(/\D/g, '').replace(/^0/, '') : '')
