import type { MetadataRoute } from 'next'
import { fetchGymName } from '@/lib/gym-name'

const BACKGROUND = '#0A0A0B'

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const gymName = await fetchGymName()
  return {
    name: gymName,
    short_name: gymName,
    description: 'Membership, check-in and renewals.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: BACKGROUND,
    theme_color: BACKGROUND,
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
