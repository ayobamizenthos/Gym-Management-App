'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'

// the router settles its own scroll a frame or two after a history step, so the page is put back more than once
const RESTORE_AFTER_MS = [0, 60, 180]

// A sheet closed from its own buttons leaves its history step behind, marked spent. Stepping
// back from it at close time would race any navigation the button started (Finish, Start) and
// undo it on a slow connection, so instead the next Back that lands on a spent step of the same
// page passes straight through it, and Back still feels like one press.
let spentOn: string | null = null
let watching = false

function watchSpentSteps() {
  if (watching) return
  watching = true
  window.addEventListener('popstate', () => {
    if (spentOn !== null && window.location.href === spentOn) {
      spentOn = null
      window.history.back()
    } else if (spentOn !== null && window.location.href !== spentOn) {
      spentOn = null
    }
  })
}

/**
 * Phones close an open sheet with their Back gesture, the way native apps do. Opening adds a
 * history step on the same page, so Back closes the sheet and leaves the page exactly where it
 * was. The step is added a tick after opening, so a sheet mounted and unmounted at once (React's
 * development double mount) never leaves a step behind.
 */
export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose)
  useLayoutEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    watchSpentSteps()
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
      spentOn = window.location.href
    }
  }, [open])
}
