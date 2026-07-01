import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Playfair_Display } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-playfair', display: 'swap' })

export const metadata: Metadata = {
  title: 'Mobilya Görselleştirici — Oda Tasarımını AI ile Dene',
  description: 'Boş odanıza mobilya yerleştirin veya mevcut mobilyalarınızı değiştirin. Yapay zeka destekli görselleştirme.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${geist.variable} ${playfair.variable}`}>
      <body className="min-h-screen">{children}</body>
    </html>
  )
}
