'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, CheckCheck } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
import { useAuth } from '@/stores/auth'
import { cn } from '@/lib/cn'
import { alertRoute } from '@/lib/alert-routes'
import {
  BUCKET_ORDER,
  FAMILIES,
  FAMILY_LABEL,
  bucketOf,
  kindOf,
  sinceNow,
  stackRuns,
  type AlertItem,
  type AlertTone,
  type Family,
} from '@/lib/notifications'

const TONE_TEXT: Record<AlertTone, string> = { good: 'text-live', warn: 'text-due', bad: 'text-out', plain: 'text-chalk' }
const TONE_WASH: Record<AlertTone, string> = { good: 'bg-live-tint', warn: 'bg-due-tint', bad: 'bg-out-tint', plain: 'bg-base-raised' }
const SKELETON_ROWS = 5

export function NotificationInbox() {
  const { items, unread, loading, markRead } = useAlerts()
  const { role } = useAuth()
  const router = useRouter()
  const [family, setFamily] = useState<Family | 'all'>('all')

  const families = useMemo(() => {
    const present = new Set<Family>()
    items.forEach(item => present.add(kindOf(item.type).family))
    return FAMILIES.filter(f => present.has(f))
  }, [items])

  const shown = useMemo(
    () => (family === 'all' ? items : items.filter(item => kindOf(item.type).family === family)),
    [items, family]
  )

  const buckets = useMemo(() => {
    const map = new Map<string, AlertItem[]>()
    for (const item of shown) {
      const key = bucketOf(item.created_at)
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return BUCKET_ORDER.filter(b => map.has(b)).map(b => [b, map.get(b)!] as const)
  }, [shown])

  const open = (item: AlertItem) => {
    if (!item.is_read) void markRead([item.id])
    router.push(alertRoute(item.type, role))
  }

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">
        {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
          <div key={i} className="h-[76px] animate-pulse rounded-lg bg-base-panel" />
        ))}
      </div>
    )
  }

  return (
    <div className="animate-rise">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl">Alerts</h1>
          <p className="mt-1.5 text-[15px] text-chalk-dim">
            {unread > 0 ? unread + ' unread' : 'Nothing unread'}
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={() => void markRead()}
            className="-my-2 flex min-h-[44px] items-center gap-1.5 py-2 text-sm font-semibold text-live underline-offset-4 hover:underline"
          >
            <CheckCheck size={16} aria-hidden /> Mark all read
          </button>
        )}
      </header>

      {families.length > 1 && (
        <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto">
          {(['all', ...families] as const).map(key => (
            <button
              key={key}
              onClick={() => setFamily(key)}
              aria-pressed={family === key}
              className={cn(
                'h-11 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors',
                family === key ? 'bg-chalk text-inverse' : 'border border-edge text-mute hover:text-chalk'
              )}
            >
              {key === 'all' ? 'All' : FAMILY_LABEL[key]}
            </button>
          ))}
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-24 text-center">
          <BellOff size={40} className="mx-auto text-edge" aria-hidden />
          <p className="mt-4 text-[15px] text-mute">
            {items.length === 0 ? 'No alerts yet. Anything that needs you shows up here.' : 'Nothing in this group.'}
          </p>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-7">
          {buckets.map(([bucket, list]) => (
            <section key={bucket}>
              <h2 className="font-body text-[11px] font-semibold uppercase tracking-[0.22em] text-mute">{bucket}</h2>
              <ul role="list" className="mt-3 flex flex-col gap-2">
                {stackRuns(list).map(({ lead, also }) => {
                  const kind = kindOf(lead.type)
                  const unreadRun = [lead, ...also].filter(item => !item.is_read).map(item => item.id)
                  return (
                    <li key={lead.id}>
                      <button
                        onClick={() => {
                          if (unreadRun.length > 0) void markRead(unreadRun)
                          open(lead)
                        }}
                        className={cn(
                          'flex w-full items-start gap-3.5 rounded-lg px-4 py-3.5 text-left transition-colors',
                          lead.is_read ? 'bg-base-panel/60 hover:bg-base-panel' : 'bg-base-panel hover:bg-base-raised'
                        )}
                      >
                        <span className={cn('mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full', TONE_WASH[kind.tone])}>
                          <kind.icon size={17} className={TONE_TEXT[kind.tone]} aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <span className={cn('truncate text-[15px]', lead.is_read ? 'font-medium text-chalk-dim' : 'font-semibold text-chalk')}>
                              {lead.title}
                            </span>
                            {also.length > 0 && (
                              <span className="shrink-0 rounded-full bg-base-raised px-1.5 py-0.5 text-[11px] font-semibold text-mute">
                                +{also.length}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block line-clamp-2 text-sm text-mute">{lead.message}</span>
                          <span className="mt-1 block text-xs text-mute">{sinceNow(lead.created_at)}</span>
                        </span>
                        {!lead.is_read && (
                          <>
                            <span aria-hidden className="mt-2 h-2 w-2 shrink-0 rounded-full bg-live" />
                            <span className="sr-only">Unread</span>
                          </>
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
