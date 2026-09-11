'use client'

import { useToasts } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { X } from 'lucide-react'

export function ToastHost() {
  const { items, dismiss } = useToasts()
  if (items.length === 0) return null
  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-4 z-[90] flex flex-col gap-2 sm:left-auto sm:right-5 sm:w-96">
      {items.map(t => (
        <div
          key={t.id}
          className={cn(
            'pointer-events-auto flex animate-rise items-start gap-3 border bg-base-panel px-4 py-3',
            t.tone === 'good' && 'border-live',
            t.tone === 'bad' && 'border-out',
            t.tone === 'info' && 'border-edge'
          )}
        >
          <span
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0',
              t.tone === 'good' && 'bg-live',
              t.tone === 'bad' && 'bg-out',
              t.tone === 'info' && 'bg-mute'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{t.title}</p>
            {t.message && <p className="mt-0.5 text-sm text-mute">{t.message}</p>}
          </div>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-mute hover:text-chalk">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  )
}
