import { BadgeCheck, Hourglass, CircleX, Clock, Gift, UserPlus, PartyPopper } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Role } from './types'
import { plural } from './format'

export interface AlertItem {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
}


/** The groups a member or staff member actually thinks in. */
export type Family = 'money' | 'membership' | 'rewards'

export type AlertTone = 'good' | 'warn' | 'bad' | 'plain'

interface AlertKind {
  icon: LucideIcon
  /** Drives the accent, so a rejection never reads the same as a confirmation. */
  tone: AlertTone
  family: Family
  /** Where tapping the alert should take you. */
  href: (role: Role | null) => string
}

/** Every notification type the database emits, and how the app presents it. */
export const ALERT_KINDS = {
  payment_confirmed: { icon: BadgeCheck, tone: 'good', family: 'money', href: () => '/m/history' },
  payment_rejected: { icon: CircleX, tone: 'bad', family: 'money', href: () => '/m/history' },
  payment_pending: { icon: Hourglass, tone: 'warn', family: 'money', href: () => '/desk/payments' },
  member_joined: { icon: UserPlus, tone: 'good', family: 'membership', href: () => '/desk/members' },
  renewals_due: {
    icon: Clock,
    tone: 'warn',
    family: 'membership',
    href: role => (role === 'member' ? '/m/renew' : '/desk/members'),
  },
  referral_reward: { icon: Gift, tone: 'good', family: 'rewards', href: () => '/m/referrals' },
  referral_joined: { icon: UserPlus, tone: 'good', family: 'rewards', href: () => '/m/referrals' },
  birthday: { icon: PartyPopper, tone: 'good', family: 'rewards', href: () => '/m' },
} satisfies Record<string, AlertKind>

export type AlertType = keyof typeof ALERT_KINDS

const FALLBACK_KIND: AlertKind = { icon: BadgeCheck, tone: 'plain', family: 'membership', href: () => '/m' }

const isAlertType = (type: string): type is AlertType => type in ALERT_KINDS

export const kindOf = (type: string): AlertKind => (isAlertType(type) ? ALERT_KINDS[type] : FALLBACK_KIND)

export const FAMILIES: Family[] = ['money', 'membership', 'rewards']

export const FAMILY_LABEL: Record<Family, string> = {
  money: 'Payments',
  membership: 'Membership',
  rewards: 'Rewards',
}

const MAX_BADGE = 99

export const badgeCount = (unread: number) => (unread > MAX_BADGE ? MAX_BADGE + '+' : String(unread))

const DAY_MS = 86_400_000
const STACK_WINDOW_MS = 6 * 60 * 60 * 1000

/**
 * Alerts are read newest first, so the inbox is grouped by when it happened.
 * Grouping by type instead would bury a rejection from this morning under last
 * month's confirmations. Filtering by family covers the other need.
 */
export function bucketOf(iso: string, now = new Date()): string {
  const then = new Date(iso)
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.floor((startOfToday - new Date(then.getFullYear(), then.getMonth(), then.getDate()).getTime()) / DAY_MS)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return 'This week'
  if (days < 30) return 'This month'
  return 'Earlier'
}

export const BUCKET_ORDER = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier']

export function sinceNow(iso: string, now = Date.now()): string {
  const seconds = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000))
  if (seconds < 60) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return minutes + ' ' + plural(minutes, 'min') + ' ago'
  const hours = Math.round(minutes / 60)
  if (hours < 24) return hours + ' ' + plural(hours, 'hour') + ' ago'
  const days = Math.round(hours / 24)
  if (days < 7) return days + ' ' + plural(days, 'day') + ' ago'
  return new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short' })
}

export interface Stack {
  lead: AlertItem
  also: AlertItem[]
}

/**
 * Several unread alerts of the same kind arriving together are one event to
 * the reader: four transfers waiting is a single "4 transfers waiting" line.
 * Once read, the history stays itemised.
 */
export function stackRuns(items: AlertItem[]): Stack[] {
  const stacks: Stack[] = []
  for (const item of items) {
    const previous = stacks[stacks.length - 1]
    const sameRun =
      previous &&
      previous.lead.type === item.type &&
      !previous.lead.is_read &&
      !item.is_read &&
      Math.abs(new Date(previous.lead.created_at).getTime() - new Date(item.created_at).getTime()) < STACK_WINDOW_MS
    if (sameRun) previous.also.push(item)
    else stacks.push({ lead: item, also: [] })
  }
  return stacks
}
