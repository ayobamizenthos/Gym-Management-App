'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props {
  title: string
  count?: number | string
  defaultOpen?: boolean
  children: React.ReactNode
}

/** Collapsible section. Keeps long staff screens scannable on a phone without
 *  hiding anything behind a separate page load. */
export function Accordion({ title, count, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const panelId = useId()

  return (
    <section className="border-b border-edge-soft">
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen(v => !v)}
          className="flex w-full items-center justify-between gap-3 py-4 text-left"
        >
          <span className="flex items-center gap-2.5">
            <span className="text-[17px] font-semibold">{title}</span>
            {count !== undefined && (
              <span className="rounded-full bg-base-raised px-2 py-0.5 text-xs font-semibold text-mute">
                {count}
              </span>
            )}
          </span>
          <ChevronDown
            size={18}
            aria-hidden
            className={cn('shrink-0 text-mute transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      </h3>
      <div
        id={panelId}
        hidden={!open}
        className={cn(open && 'animate-rise pb-5')}
      >
        {children}
      </div>
    </section>
  )
}
