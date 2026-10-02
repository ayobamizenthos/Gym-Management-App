'use client'

import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ExerciseList } from '@/components/workouts/ExerciseList'
import { useModal } from '@/hooks/useModal'
import { plural } from '@/lib/format'

interface Props {
  /** Replacing takes the first tap; adding collects a selection. */
  mode: 'add' | 'replace'
  recent?: string[]
  onDone: (ids: string[]) => void
  onClose: () => void
}

/** Full screen, because choosing from 1,283 exercises deserves the whole phone. */
export function ExercisePicker({ mode, recent, onDone, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState<string[]>([])
  useModal(panel, onClose)

  const toggle = (id: string) => {
    if (mode === 'replace') {
      onDone([id])
      return
    }
    setSelected(current => (current.includes(id) ? current.filter(item => item !== id) : [...current, id]))
  }

  return createPortal(
    <div
      ref={panel}
      role="dialog"
      aria-modal="true"
      aria-label={mode === 'replace' ? 'Replace exercise' : 'Add exercises'}
      className="fixed inset-0 z-[80] animate-rise overflow-y-auto bg-base"
    >
      <div className="mx-auto max-w-2xl px-5 pb-36 pt-[max(0.5rem,env(safe-area-inset-top))]">
        <div className="sticky top-0 z-10 -mx-5 grid h-14 grid-cols-[1fr_auto_1fr] items-center bg-base px-5">
          <button type="button" onClick={onClose} className="h-11 justify-self-start text-[15px] font-semibold text-mute">
            Cancel
          </button>
          <h2 className="font-body text-[17px] font-bold normal-case tracking-normal">
            {mode === 'replace' ? 'Replace exercise' : 'Add exercise'}
          </h2>
          <span />
        </div>
        <ExerciseList mode="pick" selected={selected} onToggle={toggle} recent={recent} />
      </div>

      {mode === 'add' && selected.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-base via-base/95 to-transparent px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-8">
          <button type="button" onClick={() => onDone(selected)} className="btn-primary mx-auto flex w-full max-w-md animate-rise">
            Add {selected.length} {plural(selected.length, 'exercise')}
          </button>
        </div>
      )}
    </div>,
    document.body
  )
}
