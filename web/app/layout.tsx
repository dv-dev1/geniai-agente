import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import Image from 'next/image'
import Link from 'next/link'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = { title: 'GeniAI · Leads' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={inter.variable}>
      <body className="min-h-screen bg-fundo font-sans text-texto antialiased">
        <header className="border-b border-borda">
          <nav className="mx-auto flex max-w-6xl items-center gap-8 px-4 py-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <Image src="/geniai-icone.png" alt="" width={28} height={28} />
              <span className="text-xl font-medium tracking-tight">geniAI</span>
            </Link>
            <Link href="/" className="text-sm text-suave hover:text-white">
              Visão geral
            </Link>
            <Link href="/leads" className="text-sm text-suave hover:text-white">
              Leads
            </Link>
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
      </body>
    </html>
  )
}
