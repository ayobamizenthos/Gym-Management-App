'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export interface Option {
  value: string
  label: string
  hint?: string
}

interface Props {
  value: string
  options: Option[]
  onChange: (value: string) => void
  label?: string
  placeholder?: string
  className?: string
}

/**
 * A native select drops the operating system's own list onto the screen, which
 * on Android is a grey system dialog that looks nothing like the rest of the
 * app. This keeps the choice inside our own surface: a sheet on a phone, a
 * popover on a desktop, dismissed by Escape, a tap outside, or a choice.
 */
export function Select({ value, options, onChange, label, placeholder = 'Select', className }: Props) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const listId = useId()
  const chosen = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label={label}
        className="field flex items-center justify-between gap-3 text-left"
      >
        <span className={cn('min-w-0 truncate', chosen ? 'text-chalk' : 'text-mute')}>
          {chosen?.label ?? placeholder}
        </span>
        <ChevronDown
          size={17}
          aria-hidden
          className={cn('shrink-0 text-mute transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      {open && (
        <>
          {/* on a phone the list rises from the bottom, where the thumb already is */}
          <div
            aria-hidden
            className="fixed inset-0 z-[70] bg-base/60 backdrop-blur-[2px] sm:hidden"
            onClick={() => setOpen(false)}
          />
          <ul
            id={listId}
            role="listbox"
            aria-label={label}
            className={cn(
              'z-[71] overflow-y-auto overscroll-contain rounded-lg bg-base-raised p-1.5 shadow-lift',
              'fixed inset-x-3 bottom-3 max-h-[60vh] animate-rise',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+6px)] sm:w-full sm:max-h-64'
            )}
          >
            {options.map(option => {
              const on = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={on}
                    onClick={() => { onChange(option.value); setOpen(false) }}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-md px-3.5 py-3 text-left transition-colors',
                      on ? 'bg-live-tint text-chalk' : 'text-chalk-dim hover:bg-base-panel hover:text-chalk'
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{option.label}</span>
                      {option.hint && <span className="block truncate text-sm text-mute">{option.hint}</span>}
                    </span>
                    {on && <Check size={17} className="shrink-0 text-live" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
