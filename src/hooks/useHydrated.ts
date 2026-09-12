'use client'

import { useEffect, useState } from 'react'

/**
 * False until React has taken over the prerendered markup.
 *
 * On a slow connection there is a real window where the page is painted and
 * typeable but the submit handler does not exist yet. A tap in that window
 * submits the form natively, which reloads the page and throws away everything
 * the user typed. Gating the submit button closes it.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => setHydrated(true), [])
  return hydrated
}
