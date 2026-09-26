'use client'

import { useGymName } from '@/hooks/useSettings'
import { wordmarkParts } from '@/lib/settings'

/** The gym name with its last word in the accent colour. Styling comes from the parent. */
export function Wordmark() {
  const { lead, accent } = wordmarkParts(useGymName())
  return (
    <>
      {lead}
      {accent && <span className="text-live">{accent}</span>}
    </>
  )
}
