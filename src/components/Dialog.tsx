'use client'

import { useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useModal } from '@/hooks/useModal'
import { cn } from '@/lib/cn'

interface Props {
  title: string
  body?: string
  /** Renders a required text field and passes its value to onConfirm. */
  ask?: string
  /** When set, the confirm button only arms once the field matches this exactly. */
  requireText?: string
  confirmLabel: string
  tone?: 'normal' | 'danger'
  onConfirm: (reply: string) => void | Promise<void>
  onClose: () => void
}

/**
 * Installed PWAs suppress window.confirm and window.prompt on several Android
 * browsers, so every destructive action goes through this instead. Focus is
 * trapped while it is open and returned to whatever opened it on close.
 */
export function Dialog({ title, body, ask, requireText, confirmLabel, tone = 'normal', onConfirm, onClose }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const titleId = useId()
  useModal(panel, onClose)

  const armed = ask === undefined || (requireText ? reply.trim().toUpperCase() === requireText.toUpperCase() : reply.trim() !== '')

  const confirm = async () => {
    if (!armed) return
    setBusy(true)
    try {
      await onConfirm(reply.trim())
    } finally {
      setBusy(false)
    }
    onClose()
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[95] grid place-items-end bg-base/80 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:place-items-center"
      onClick={onClose}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={e => e.stopPropagation()}
        className="panel w-full max-w-sm animate-rise p-5"
      >
        <h2 id={titleId} className="text-2xl">{title}</h2>
        {body && <p className="mt-2 text-[15px] text-chalk-dim">{body}</p>}

        {ask !== undefined && (
          <label className="mt-4 block">
            <span className="label">{ask}</span>
            <input
              value={reply}
              onChange={e => setReply(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && armed && void confirm()}
              className="field mt-1.5"
            />
          </label>
        )}

        <div className="mt-5 grid grid-cols-2 gap-2.5">
          <button onClick={onClose} className="btn-quiet w-full">Cancel</button>
          <button
            onClick={() => void confirm()}
            disabled={busy || !armed}
            className={cn('w-full', tone === 'danger' ? 'btn bg-out text-chalk hover:brightness-110' : 'btn-primary')}
          >
            {busy ? <span className="dots">Processing</span> : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
