import { fileURLToPath } from 'node:url'

const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL
if (!supabase) throw new Error('NEXT_PUBLIC_SUPABASE_URL must be set')
const realtime = supabase.replace(/^https:/, 'wss:')

// Next's streamed hydration payload is inline script, hence 'unsafe-inline';
// everything else is pinned to the hosts the app actually talks to.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.paystack.co",
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${supabase}`,
  "font-src 'self'",
  `connect-src 'self' ${supabase} ${realtime} https://api.paystack.co`,
  'frame-src https://*.paystack.co https://*.paystack.com',
  "worker-src 'self'",
  "manifest-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=()' },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // a lockfile higher up the disk would otherwise be taken as the workspace root
  turbopack: { root: fileURLToPath(new URL('.', import.meta.url)) },
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 31536000,
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
