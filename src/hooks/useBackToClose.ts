'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

// the router settles its own scroll a frame or two after a history step, so the page is put back more than once
const RESTORE_AFTER_MS = [0, 60, 180]

/**
 * Phones close an open sheet with their Back gesture, the way native apps do. Opening adds a
 * history step on the same page, so Back closes the sheet and leaves the page exactly where it
 * was; closing from inside the sheet takes that step away again, so Back still leaves the page.
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
    window.history.pushState({ ...window.history.state, sheet: marker }, '')
    let closedByBack = false
    const onPop = () => {
      closedByBack = true
      closeRef.current()
      putPageBack()
    }
    window.addEventListener('popstate', onPop)
    return () => {
      window.removeEventListener('popstate', onPop)
      if (closedByBack || window.history.state?.sheet !== marker) return
      window.history.back()
      putPageBack()
    }
  }, [open])
}
