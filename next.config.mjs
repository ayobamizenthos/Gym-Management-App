/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
    // serve the modern formats first; they are roughly a third of the bytes
    formats: ['image/avif', 'image/webp'],
    // a year: the hero art is versioned by filename, not by query
    minimumCacheTTL: 31536000,
  },
}
export default nextConfig
