'use client'

import { useToasts } from '@/stores/toast'
import { cn } from '@/lib/cn'
import { X } from 'lucide-react'

export function ToastHost() {
  const { items, dismiss } = useToasts()
  // The live region stays mounted and empty: screen readers ignore a region
  // that appears with its content already inside it.
  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-3 bottom-[calc(var(--nav-offset)+1rem)] z-[90] flex flex-col gap-2 md:bottom-5 md:left-auto md:right-5 md:w-96"
    >
      {items.map(toast => (
        <div
          key={toast.id}
          className={cn(
            'pointer-events-auto flex animate-rise items-start gap-3 rounded-sm border bg-base-panel py-3 pl-4 pr-1 shadow-lg shadow-black/30',
            toast.tone === 'good' && 'border-live',
            toast.tone === 'bad' && 'border-out',
            toast.tone === 'info' && 'border-edge'
          )}
        >
          <span
            className={cn(
              'mt-1.5 h-2 w-2 shrink-0',
              toast.tone === 'good' && 'bg-live',
              toast.tone === 'bad' && 'bg-out',
              toast.tone === 'info' && 'bg-mute'
            )}
          />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-tight">{toast.title}</p>
            {toast.message && <p className="mt-0.5 text-sm text-mute">{toast.message}</p>}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            aria-label="Dismiss"
            className="-my-2.5 grid h-11 w-11 shrink-0 place-items-center text-mute hover:text-chalk"
          >
            <X size={16} aria-hidden />
          </button>
        </div>
      ))}
    </div>
  )
}
