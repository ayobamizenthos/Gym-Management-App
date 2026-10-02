'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

// the router settles its own scroll a frame or two after a history step, so the page is put back more than once
const RESTORE_AFTER_MS = [0, 60, 180]

/**
 * Phones close an open sheet with their Back gesture, the way native apps do. Opening adds a
 * history step on the same page, so Back closes the sheet and leaves the page exactly where it
 * was; closing from inside the sheet takes that step away again, so Back still leaves the page.
 * The step is added a tick after opening, so a sheet mounted and unmounted at once (React's
 * development double mount) never leaves a step behind that would close its successor.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const marker = Math.random().toString(36).slice(2)
    const scrolledTo = window.scrollY
    const putPageBack = () => {
      for (const delay of RESTORE_AFTER_MS) window.setTimeout(() => window.scrollTo(0, scrolledTo), delay)
    }
    let pushed = false
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      closeRef.current()
      putPageBack()
    }
    const timer = window.setTimeout(() => {
      window.history.pushState({ ...window.history.state, sheet: marker }, '')
      pushed = true
      window.addEventListener('popstate', onPop)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('popstate', onPop)
      if (!pushed || closedByBack || window.history.state?.sheet !== marker) return
      window.history.back()
      putPageBack()
    }
  }, [open])
}
