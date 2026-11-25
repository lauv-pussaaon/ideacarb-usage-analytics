import type { Metadata } from 'next'
import localFont from 'next/font/local'
import AppTheme from '@/components/AppTheme'

const anuphan = localFont({
  src: [
    { path: '../fonts/anuphan-400.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/anuphan-500.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/anuphan-600.ttf', weight: '600', style: 'normal' },
    { path: '../fonts/anuphan-700.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-anuphan',
})

export const metadata: Metadata = {
  title: 'IdeaCarb Analytics',
  description: 'Signed-in client usage',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={anuphan.variable}>
      <body style={{ margin: 0 }}>
        <AppTheme>{children}</AppTheme>
      </body>
    </html>
  )
}
