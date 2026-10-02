'use client'

import { useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { cn } from '@/lib/cn'

export interface SheetAction {
  label: string
  icon?: LucideIcon
  onSelect: () => void
  tone?: 'normal' | 'danger'
  chosen?: boolean
}

interface Props {
  title?: string
  actions: SheetAction[]
  onClose: () => void
}

/** A short list of choices rising from the bottom edge, where the thumb already is. */
export function ActionSheet({ title, actions, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  useModal(panel, onClose)

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-base/75 backdrop-blur-sm" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md animate-rise rounded-t-xl bg-base-panel px-2 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      >
        <span aria-hidden className="mx-auto mb-2 block h-1 w-10 rounded-full bg-edge" />
        {title && (
          <p id={titleId} className="px-3 pb-2 pt-1 text-[13px] font-medium text-mute">
            {title}
          </p>
        )}
        <ul role="list" className="max-h-[60dvh] overflow-y-auto no-scrollbar">
          {actions.map(action => (
            <li key={action.label}>
              <button
                type="button"
                onClick={() => {
                  action.onSelect()
                  onClose()
                }}
                className={cn(
                  'flex min-h-[52px] w-full items-center gap-3.5 rounded-md px-3 text-left text-[16px] font-medium transition-colors active:bg-base-raised',
                  action.tone === 'danger' ? 'text-out' : 'text-chalk'
                )}
              >
                {action.icon && <action.icon size={20} aria-hidden className={action.tone === 'danger' ? 'text-out' : 'text-mute'} />}
                <span className="flex-1">{action.label}</span>
                {action.chosen && <Check size={19} strokeWidth={2.6} className="text-live" aria-hidden />}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  )
}
