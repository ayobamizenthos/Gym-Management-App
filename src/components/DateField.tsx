'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays } from 'lucide-react'
import { useModal } from '@/hooks/useModal'
import { cn } from '@/lib/cn'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const OLDEST_AGE = 90
// the year list opens here when nothing is picked yet, the age most members sign up at
const START_AGE = 25

interface Parts {
  day: number
  month: number
  year: number
}

const pad = (value: number) => String(value).padStart(2, '0')
const daysIn = (month: number, year: number) => new Date(year, month + 1, 0).getDate()

function parse(value: string): Parts | null {
  const [year, month, day] = value.split('-').map(Number)
  return year && month && day ? { day, month: month - 1, year } : null
}

function Column({ label, items, chosen, onChoose }: { label: string; items: { value: number; text: string }[]; chosen: number; onChoose: (value: number) => void }) {
  const list = useRef<HTMLUListElement>(null)

  useEffect(() => {
    list.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.scrollIntoView({ block: 'center' })
  }, [])

  return (
    <div className="min-w-0 flex-1">
      <p className="pb-2 text-center text-[13px] font-medium text-mute">{label}</p>
      <ul ref={list} role="listbox" aria-label={label} className="h-[264px] overflow-y-auto overscroll-contain no-scrollbar">
        {items.map(item => (
          <li key={item.value} role="option" aria-selected={item.value === chosen}>
            <button
              type="button"
              onClick={() => onChoose(item.value)}
              className={cn(
                'h-11 w-full rounded-md text-[17px] tabular-nums transition-colors',
                item.value === chosen ? 'bg-chalk font-semibold text-inverse' : 'text-chalk active:bg-base-raised'
              )}
            >
              {item.text}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Picker({ value, onDone, onClose }: { value: string; onDone: (value: string) => void; onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null)
  const thisYear = new Date().getFullYear()
  const [parts, setParts] = useState<Parts>(() => parse(value) ?? { day: 1, month: 0, year: thisYear - START_AGE })
  useModal(panel, onClose)

  const lastDay = daysIn(parts.month, parts.year)
  const day = Math.min(parts.day, lastDay)
  const years = Array.from({ length: OLDEST_AGE }, (_, index) => thisYear - index)

  return createPortal(
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-base/70 backdrop-blur-[2px]" onClick={onClose}>
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Date of birth"
        onClick={event => event.stopPropagation()}
        className="w-full max-w-md animate-rise rounded-t-xl bg-base-panel px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2 ring-1 ring-black/15 dark:ring-white/10"
      >
        <span aria-hidden className="mx-auto mb-3 block h-1 w-10 rounded-full bg-edge" />
        <p className="text-center text-[20px] font-semibold">
          {day} {MONTHS[parts.month]} {parts.year}
        </p>
        <div className="mt-4 flex gap-2">
          <Column
            label="Day"
            items={Array.from({ length: lastDay }, (_, index) => ({ value: index + 1, text: String(index + 1) }))}
            chosen={day}
            onChoose={next => setParts({ ...parts, day: next })}
          />
          <Column label="Month" items={MONTHS.map((text, index) => ({ value: index, text }))} chosen={parts.month} onChoose={next => setParts({ ...parts, month: next })} />
          <Column label="Year" items={years.map(year => ({ value: year, text: String(year) }))} chosen={parts.year} onChoose={next => setParts({ ...parts, year: next })} />
        </div>
        <button type="button" onClick={() => onDone(`${parts.year}-${pad(parts.month + 1)}-${pad(day)}`)} className="btn-primary mt-4 w-full">
          Done
        </button>
      </div>
    </div>,
    document.body
  )
}

/** A date of birth picked from day, month and year lists in our own sheet, never the browser's calendar. */
export function DateField({ value, onChange, required }: { value: string; onChange: (value: string) => void; required?: boolean }) {
  const [open, setOpen] = useState(false)
  const parts = parse(value)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="field mt-1.5 flex items-center justify-between text-left">
        <span className={cn(!parts && 'text-mute')}>{parts ? `${parts.day} ${MONTHS[parts.month]} ${parts.year}` : 'Choose date'}</span>
        <CalendarDays size={18} aria-hidden className="text-mute" />
      </button>
      {required && <input tabIndex={-1} aria-hidden required value={value} onChange={() => undefined} className="pointer-events-none absolute h-px w-px opacity-0" />}
      {open && (
        <Picker
          value={value}
          onClose={() => setOpen(false)}
          onDone={next => {
            onChange(next)
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
