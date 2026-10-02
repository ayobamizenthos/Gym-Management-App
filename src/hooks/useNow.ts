'use client'

import { useEffect, useState } from 'react'

/** The current time, re-read every `everyMs` while `running`. */
export function useNow(everyMs = 1000, running = true) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!running) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), everyMs)
    return () => window.clearInterval(timer)
  }, [everyMs, running])
  return now
}
