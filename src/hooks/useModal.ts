'use client'

import { useEffect } from 'react'
import type { RefObject } from 'react'
import { useLatest } from '@/hooks/useLatest'
import { useBackToClose } from '@/hooks/useBackToClose'

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

/**
 * Focus moves into the panel, Tab cycles inside it, Escape closes it, the page
 * behind stops scrolling, focus returns to the opener on close, and the phone's
 * Back gesture closes it instead of leaving the page.
 */
export function useModal(panel: RefObject<HTMLElement | null>, onClose: () => void) {
  const closeRef = useLatest(onClose)
  useBackToClose(true, onClose)

  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    panel.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }
      if (event.key !== 'Tab') return
      const stops = panel.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!stops || stops.length === 0) return
      const first = stops[0]
      const last = stops[stops.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    const scrollLocked = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = scrollLocked
      opener?.focus()
    }
  }, [panel, closeRef])
}
