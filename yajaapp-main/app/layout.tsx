import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { RootClientLayout } from '@/components/providers/RootClientLayout'

export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'YAJA Asistencia',
  description: 'Plataforma YAJA Asistencia',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/apple-touch-icon.png', sizes: '180x180' },
    ],
  },
  manifest: '/site.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'YAJA',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <RootClientLayout>{children}</RootClientLayout>
      </body>
    </html>
  )
}

