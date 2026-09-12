import { BadgeCheck, Hourglass, CircleX, Clock, Gift, UserPlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface Notification {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}

/** The families a member or staff member actually thinks in. */
export type Family = 'money' | 'membership' | 'rewards'

interface Kind {
  icon: LucideIcon
  /** Drives the accent, so a rejection never reads the same as a confirmation. */
  tone: 'good' | 'warn' | 'bad' | 'plain'
  family: Family
  /** Where tapping the alert should take you. */
  href: (role: string | null) => string
}

const KINDS: Record<string, Kind> = {
  payment_confirmed: { icon: BadgeCheck,      tone: 'good',  family: 'money',      href: () => '/m/history' },
  payment_rejected:  { icon: CircleX,         tone: 'bad',   family: 'money',      href: () => '/m/history' },
  payment_pending:   { icon: Hourglass, tone: 'warn',  family: 'money',      href: () => '/desk/payments' },
  member_joined:     { icon: UserPlus,        tone: 'good',  family: 'membership', href: () => '/desk/members' },
  renewals_due:      { icon: Clock,           tone: 'warn',  family: 'membership', href: r => (r === 'member' ? '/m/renew' : '/desk/members') },
  referral_reward:   { icon: Gift,            tone: 'good',  family: 'rewards',    href: () => '/m/referrals' },
  referral_joined:   { icon: UserPlus,        tone: 'good',  family: 'rewards',    href: () => '/m/referrals' },
}

const FALLBACK: Kind = { icon: BadgeCheck, tone: 'plain', family: 'membership', href: () => '/m' }

export const kindOf = (type: string): Kind => KINDS[type] ?? FALLBACK

export const FAMILY_LABEL: Record<Family, string> = {
  money: 'Payments',
  membership: 'Membership',
  rewards: 'Rewards',
}

/**
 * Alerts are read newest first, so the inbox is grouped by when it happened -
 * grouping by type instead would bury a rejection from this morning under last
 * month's confirmations. Filtering by family covers the other need.
 */
export function bucketOf(iso: string, now = new Date()): string {
  const then = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.floor((startOfToday - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  if (days < 30) return 'This month'
  return 'Earlier'
}

export const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier']

/** "2 minutes ago" reads better than a timestamp on something that just landed. */
export function sinceNow(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return minutes + (minutes === 1 ? ' min ago' : ' mins ago')
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + (hours === 1 ? ' hour ago' : ' hours ago')
  const days = Math.round(hours / 24)
  if (days < 7) return days + (days === 1 ? ' day ago' : ' days ago')
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

/**
 * Several alerts of the same kind arriving together are one event to the reader:
 * four transfers waiting is a single "4 transfers waiting" line, not four lines.
 * Only unread runs are stacked - once read, the history stays itemised.
 */
export interface Stack {
  lead: Notification
  also: Notification[]
}

export function stackRuns(items: Notification[]): Stack[] {
  const out: Stack[] = []
  for (const item of items) {
    const previous = out[out.length - 1]
    const sameRun =
      previous &&
      previous.lead.type === item.type &&
      !previous.lead.is_read &&
      !item.is_read &&
      Math.abs(new Date(previous.lead.created_at).getTime() - new Date(item.created_at).getTime()) < 6 * 60 * 60 * 1000
    if (sameRun) previous.also.push(item)
    else out.push({ lead: item, also: [] })
  }
  return out
}
