import Image from 'next/image'
import Link from 'next/link'
import { sair } from '../login/acoes.ts'

export default function LayoutPainel({ children }: { children: React.ReactNode }) {
  return (
    <>
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
          <form action={sair} className="ml-auto">
            <button type="submit" className="text-sm text-suave transition-colors duration-150 hover:text-white">
              Sair
            </button>
          </form>
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </>
  )
}
