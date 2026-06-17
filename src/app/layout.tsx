import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })

export const metadata: Metadata = {
  title: 'Mobilya Görselleştirici — Oda Tasarımını AI ile Dene',
  description: 'Boş odanıza mobilya yerleştirin veya mevcut mobilyalarınızı değiştirin. Yapay zeka destekli görselleştirme.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={geist.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
