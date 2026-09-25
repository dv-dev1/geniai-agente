import { ETAPA, PRIORIDADE, STATUS } from '@/lib/rotulos.ts'

const COR_PRIORIDADE: Record<string, string> = {
  quente: 'bg-quente/15 text-quente',
  morno: 'bg-morno/15 text-morno',
  frio: 'bg-frio/15 text-frio',
}
const COR_STATUS: Record<string, string> = {
  a_contatar: 'border-ciano/40 text-ciano',
  fechado: 'border-[#08fbd0]/40 text-[#08fbd0]',
  perdido: 'border-borda text-suave',
}

export function Cabecalho({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <header className="surgir space-y-2">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-ciano">Painel comercial</p>
      <h1 className="titulo-gradiente text-4xl font-medium tracking-[-0.05em] sm:text-5xl">{titulo}</h1>
      {descricao && <p className="text-sm text-suave">{descricao}</p>}
    </header>
  )
}

export function SeloPrioridade({ temperatura }: { temperatura: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs ${COR_PRIORIDADE[temperatura] ?? ''}`}
    >
      <span className="size-1.5 rounded-full bg-current" />
      {PRIORIDADE[temperatura] ?? temperatura}
    </span>
  )
}

export function Pontuacao({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs text-suave">
      <span className="h-1 w-12 rounded-full bg-superficie">
        <span className="gradiente-marca block h-1 rounded-full" style={{ width: `${score}%` }} />
      </span>
      <span className="tabular-nums">{score}/100</span>
    </span>
  )
}

export function SeloEtapa({ etapa }: { etapa: string }) {
  return <Selo>{ETAPA[etapa] ?? etapa}</Selo>
}

export function SeloStatus({ status }: { status: string }) {
  return <Selo cor={COR_STATUS[status]}>{STATUS[status] ?? status}</Selo>
}

export function Selo({ children, cor }: { children: React.ReactNode; cor?: string }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs ${cor ?? 'border-borda text-texto'}`}>
      {children}
    </span>
  )
}
