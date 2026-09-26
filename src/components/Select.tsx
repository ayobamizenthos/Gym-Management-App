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
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const listId = useId()
  const chosen = options.find(o => o.value === value)

  useEffect(() => {
    if (!open) return
    list.current?.focus({ preventScroll: true })
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  useEffect(() => {
    if (open) document.getElementById(listId + '-' + active)?.scrollIntoView({ block: 'nearest' })
  }, [open, active, listId])

  const show = () => {
    setActive(Math.max(0, options.findIndex(o => o.value === value)))
    setOpen(true)
  }

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  const pick = (option: Option) => {
    onChange(option.value)
    close()
  }

  const onTriggerKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      show()
    }
  }

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
    }
    if (e.key in moves) {
      e.preventDefault()
      setActive(moves[e.key])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (options[active]) pick(options[active])
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      close()
    }
  }

  return (
    <div ref={root} className={cn('relative', className)}>
      <button
        ref={trigger}
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onTriggerKey}
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
            className="fixed inset-0 z-[70] bg-base/60 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none"
            onClick={() => setOpen(false)}
          />
          <ul
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-label={label}
            aria-activedescendant={listId + '-' + active}
            onKeyDown={onListKey}
            className={cn(
              'z-[71] overflow-y-auto overscroll-contain rounded-lg bg-base-raised p-1.5 shadow-lift outline-none',
              'fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] max-h-[60dvh] animate-rise',
              'sm:absolute sm:inset-x-auto sm:bottom-auto sm:left-0 sm:top-[calc(100%+6px)] sm:w-full sm:max-h-64'
            )}
          >
            {options.map((option, index) => {
              const on = option.value === value
              return (
                <li
                  key={option.value}
                  id={listId + '-' + index}
                  role="option"
                  aria-selected={on}
                  onClick={() => pick(option)}
                  onPointerMove={() => setActive(index)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-md px-3.5 py-3 transition-colors',
                    on ? 'bg-live-tint text-chalk' : 'text-chalk-dim hover:text-chalk',
                    index === active && !on && 'bg-base-panel'
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{option.label}</span>
                    {option.hint && <span className="block truncate text-sm text-mute">{option.hint}</span>}
                  </span>
                  {on && <Check size={17} className="shrink-0 text-live" aria-hidden />}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </div>
  )
}
