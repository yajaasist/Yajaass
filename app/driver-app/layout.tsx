import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Yaja Driver App - Aplicación para Conductores',
  description: 'Aplicación oficial para conductores de Yaja. Gestiona tus viajes, ganancias, notificaciones y más.',
  manifest: '/driver-app-manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Yaja Driver',
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: 'website',
    siteName: 'Yaja Driver App',
    title: 'Yaja Driver App',
    description: 'Aplicación oficial para conductores de Yaja',
  },
  twitter: {
    card: 'summary',
    title: 'Yaja Driver App',
    description: 'Aplicación oficial para conductores de Yaja',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  minimumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#3B82F6',
}

export default function DriverAppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <head>
        <link rel="manifest" href="/driver-app-manifest.json" />
        <meta name="theme-color" content="#3B82F6" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Yaja Driver" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3B82F6" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        {/* Prevent zoom on input focus */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, minimum-scale=1, user-scalable=no, viewport-fit=cover" />
        <style>
          {`
            /* Prevent zoom on iOS Safari */
            input[type="text"],
            input[type="email"],
            input[type="password"],
            input[type="number"],
            input[type="tel"],
            input[type="search"],
            textarea,
            select {
              font-size: 16px !important;
            }

            /* Prevent bounce scroll on iOS */
            body {
              -webkit-overflow-scrolling: touch;
              overscroll-behavior: none;
            }

            /* Fullscreen styles */
            html, body {
              height: 100%;
              margin: 0;
              padding: 0;
              overflow: hidden;
            }

            #__next {
              height: 100vh;
              overflow: hidden;
            }
          `}
        </style>
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}