'use client'

import { useEffect, useState } from 'react'
import { signedAvatar } from '@/lib/avatar'
import { cn } from '@/lib/cn'

interface Props {
  path: string | null | undefined
  name: string | null | undefined
  size?: number
  className?: string
}

/** Member photo with an initial fallback. Resolves the signed URL lazily so a
 *  list of members does not block on image permissions it may never need. */
export function Avatar({ path, name, size = 40, className }: Props) {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    void signedAvatar(path).then(next => {
      if (live) setUrl(next)
    })
    return () => {
      live = false
    }
  }, [path])

  return (
    <span
      className={cn(
        'relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-base-raised',
        className
      )}
      style={{ width: size, height: size }}
    >
      {url ? (
        // Signed URLs expire, so Next's optimiser is bypassed deliberately.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <span className="font-display uppercase text-mute" style={{ fontSize: size * 0.4 }}>
          {(name ?? 'M').charAt(0)}
        </span>
      )}
    </span>
  )
}
