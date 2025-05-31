import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import ParticlesBackground from '@/components/ParticlesBackground'
import Navigation from '@/components/Navigation'
import { AuthProvider } from '@/lib/auth-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Tafelvoetbal Competitie',
  description: 'Kantoor tafelvoetbal competitie tracker',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Tafelvoetbal',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0d1b24',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <head>
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
        <div className="min-h-screen bg-[#0d1b24] text-white relative">
          {/* Stadium Background Image */}
          <div 
            className="fixed inset-0 bg-cover bg-center bg-no-repeat"
            style={{
              backgroundImage: 'url(https://785d2dbc.delivery.rocketcdn.me/content/uploads/2022/11/shutterstock-1914172519-scaled.jpg?v=1698074134)',
              opacity: 0.04,
              zIndex: 1
            }}
          />
          
          <ParticlesBackground />
          <div className="relative z-20">
            {children}
          </div>
          <Navigation />
        </div>
        </AuthProvider>
      </body>
    </html>
  )
} 