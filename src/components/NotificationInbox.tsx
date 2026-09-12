'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BellOff, CheckCheck, Trash2 } from 'lucide-react'
import { useAlerts } from '@/stores/alerts'
import { useAuth } from '@/stores/auth'
import { Dialog } from '@/components/Dialog'
import { cn } from '@/lib/cn'
import {
  BUCKET_ORDER,
  FAMILY_LABEL,
  bucketOf,
  kindOf,
  sinceNow,
  stackRuns,
  type Family,
  type Notification,
} from '@/lib/notifications'

const TONE_TEXT = { good: 'text-live', warn: 'text-due', bad: 'text-out', plain: 'text-chalk' } as const
const TONE_WASH = { good: 'bg-live-tint', warn: 'bg-due-tint', bad: 'bg-out-tint', plain: 'bg-base-raised' } as const

export function NotificationInbox() {
  const { items, unread, loading, markRead, clearAll } = useAlerts()
  const { role } = useAuth()
  const router = useRouter()
  const [family, setFamily] = useState<Family | 'all'>('all')
  const [clearing, setClearing] = useState(false)

  const families = useMemo(() => {
    const present = new Set<Family>()
    items.forEach(n => present.add(kindOf(n.type).family))
    return (['money', 'membership', 'rewards'] as Family[]).filter(f => present.has(f))
  }, [items])

  const shown = useMemo(
    () => (family === 'all' ? items : items.filter(n => kindOf(n.type).family === family)),
    [items, family]
  )

  const buckets = useMemo(() => {
    const map = new Map<string, Notification[]>()
    for (const item of shown) {
      const key = bucketOf(item.created_at)
      const list = map.get(key)
      if (list) list.push(item)
      else map.set(key, [item])
    }
    return BUCKET_ORDER.filter(b => map.has(b)).map(b => [b, map.get(b)!] as const)
  }, [shown])

  const open = (item: Notification) => {
    if (!item.is_read) void markRead([item.id])
    router.push(kindOf(item.type).href(role))
  }

  if (loading && items.length === 0) {
    return (
      <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">
        {Array.from({ length: 5 }).map((_, i) => (
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
            {unread > 0 ? unread + (unread === 1 ? ' unread' : ' unread') : 'Nothing unread'}
          </p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            {unread > 0 && (
              <button onClick={() => void markRead()} className="btn-quiet h-10 px-3.5 text-sm">
                <CheckCheck size={16} aria-hidden /> Mark all read
              </button>
            )}
            <button
              onClick={() => setClearing(true)}
              aria-label="Clear all notifications"
              className="grid h-10 w-10 place-items-center rounded-sm border border-edge text-mute transition-colors hover:border-out hover:text-out"
            >
              <Trash2 size={16} aria-hidden />
            </button>
          </div>
        )}
      </header>

      {families.length > 1 && (
        <div className="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
          {(['all', ...families] as const).map(key => (
            <button
              key={key}
              onClick={() => setFamily(key)}
              aria-pressed={family === key}
              className={cn(
                'h-9 shrink-0 rounded-full px-4 text-[13px] font-semibold transition-colors',
                family === key ? 'bg-chalk text-ink' : 'border border-edge text-mute hover:text-chalk'
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
                  const unreadRun = [lead, ...also].filter(n => !n.is_read).map(n => n.id)
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
                        {!lead.is_read && <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-live" aria-label="Unread" />}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {clearing && (
        <Dialog
          title="Clear all alerts?"
          body="They are removed from your inbox. Payments and visits keep their own records."
          confirmLabel="Clear"
          tone="danger"
          onConfirm={clearAll}
          onClose={() => setClearing(false)}
        />
      )}
    </div>
  )
}
