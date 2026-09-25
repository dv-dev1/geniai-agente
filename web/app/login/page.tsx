import Image from 'next/image'
import { destinoSeguro } from '@/lib/sessao.ts'
import { Formulario } from './formulario.tsx'

export default async function Login({ searchParams }: { searchParams: Promise<{ de?: string }> }) {
  const { de } = await searchParams
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <div className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-ciano/10 blur-3xl" />
      <section className="cartao surgir relative w-full max-w-sm space-y-8 p-8">
        <div className="flex items-center gap-2">
          <Image src="/geniai-icone.png" alt="" width={32} height={32} priority />
          <span className="text-xl font-medium tracking-tight">geniAI</span>
        </div>
        <header className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-ciano">Painel comercial</p>
          <h1 className="titulo-gradiente text-3xl font-medium tracking-[-0.05em]">Entrar</h1>
          <p className="text-sm text-suave">Leads atendidos pela Gê no WhatsApp.</p>
        </header>
        <Formulario de={destinoSeguro(de)} />
      </section>
    </main>
  )
}
