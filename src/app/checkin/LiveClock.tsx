'use client'

import { useEffect, useState } from 'react'

const TICK_MS = 1000
const format = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export function LiveClock({ className }: { className?: string }) {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), TICK_MS)
    return () => window.clearInterval(timer)
  }, [])

  return (
    <time dateTime={now.toISOString()} className={className}>
      {format.format(now)}
    </time>
  )
}
