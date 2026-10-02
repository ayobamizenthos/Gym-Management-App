'use client'

import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

/** A row like Payment history that unfolds its contents underneath instead of opening a page. */
export function FoldRow({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false)
  const panelId = useId()
  return (
    <div className={cn('rounded-lg bg-base-panel', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
      >
        <span className="text-[15px] font-medium">{title}</span>
        <ChevronDown size={18} aria-hidden className={cn('shrink-0 text-mute transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <div id={panelId} hidden={!open} className={cn(open && 'animate-rise px-4 pb-4')}>
        {children}
      </div>
    </div>
  )
}
