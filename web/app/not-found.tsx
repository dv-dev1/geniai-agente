import Link from 'next/link'

export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <section className="cartao surgir w-full max-w-sm space-y-4 p-8 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ciano">Erro 404</p>
        <h1 className="titulo-gradiente text-3xl font-medium tracking-[-0.05em]">Página não encontrada</h1>
        <p className="text-sm text-suave">O endereço não existe ou o lead foi removido.</p>
        <Link href="/" className="botao-primario inline-block px-5 py-2 text-sm">
          Voltar ao painel
        </Link>
      </section>
    </main>
  )
}
