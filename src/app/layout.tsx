import type { Metadata, Viewport } from 'next'
import { Anton, Archivo } from 'next/font/google'
import { AuthProvider } from '@/stores/auth'
import { AlertsProvider } from '@/stores/alerts'
import { ToastHost } from '@/components/ToastHost'
import { NotificationWatcher } from '@/components/NotificationWatcher'
import { InstallPrompt } from '@/components/InstallPrompt'
import { OfflineFlag } from '@/components/OfflineFlag'
import { fetchGymName } from '@/lib/gym-name'
import './globals.css'

const display = Anton({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
})

const body = Archivo({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

export async function generateMetadata(): Promise<Metadata> {
  const gymName = await fetchGymName()
  return {
    title: gymName,
    description: 'Membership, check-in and renewals for serious gyms.',
    appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: gymName },
    icons: {
      icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
    },
  }
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F4F4F1' },
    { media: '(prefers-color-scheme: dark)', color: '#0A0A0B' },
  ],
  width: 'device-width',
  initialScale: 1,
  // an installed app does not pinch-zoom; every field is 16px so iOS never zooms on focus either
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable}`}>
      <body>
        <AuthProvider>
          <AlertsProvider>
            <NotificationWatcher />
            {children}
            <OfflineFlag />
            <ToastHost />
            <InstallPrompt />
          </AlertsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
