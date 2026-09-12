import type { Metadata, Viewport } from 'next'
import { Anton, Archivo } from 'next/font/google'
import { AuthProvider } from '@/stores/auth'
import { AlertsProvider } from '@/stores/alerts'
import { ToastHost } from '@/components/ToastHost'
import { NotificationWatcher } from '@/components/NotificationWatcher'
import { InstallPrompt } from '@/components/InstallPrompt'
import { OfflineFlag } from '@/components/OfflineFlag'
import './globals.css'

// Anton is a poster face: it does headlines and figures only.
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

export const metadata: Metadata = {
  title: 'Zenthos Gym',
  description: 'Membership, check-in and renewals for serious gyms.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Zenthos Gym' },
  icons: {
    icon: [{ url: '/icon.svg', type: 'image/svg+xml' }, { url: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/apple-icon.png', sizes: '180x180' }],
  },
}

export const viewport: Viewport = {
  themeColor: '#0A0A0B',
  width: 'device-width',
  initialScale: 1,
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
