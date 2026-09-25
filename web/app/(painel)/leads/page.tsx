import type { Metadata } from 'next'
import Link from 'next/link'
import { sql } from '@/lib/db.ts'
import { ETAPA, haQuanto, PRIORIDADE, PRODUTO, STATUS } from '@/lib/rotulos.ts'
import { Cabecalho, Pontuacao, SeloEtapa, SeloPrioridade, SeloStatus } from '../ui.tsx'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Leads' }

type Filtros = { temperatura?: string; etapa?: string; status?: string }

export default async function Leads({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams
  const temp = f.temperatura || null
  const et = f.etapa || null
  const st = f.status || null
  const leads = await sql()`select id, phone, nome_whatsapp, lead->>'nome' as nome, lead->>'empresa' as empresa,
      coalesce(lead->'servicos', '[]') as servicos, score, temperatura, etapa, status_comercial, atualizado_em
    from contatos
    where (${temp}::text is null or temperatura = ${temp})
      and (${et}::text is null or etapa = ${et})
      and (${st}::text is null or status_comercial = ${st})
    order by score desc, atualizado_em desc limit 200`

  return (
    <div className="space-y-6">
      <Cabecalho
        titulo="Leads"
        descricao={`${leads.length} ${leads.length === 1 ? 'lead' : 'leads'} · ordenados pela pontuação`}
      />
      <nav className="cartao surgir space-y-2.5 p-4">
        <Chips grupo="Prioridade" chave="temperatura" opcoes={PRIORIDADE} f={f} />
        <Chips grupo="Etapa" chave="etapa" opcoes={ETAPA} f={f} />
        <Chips grupo="Status" chave="status" opcoes={STATUS} f={f} />
      </nav>
      <div className="cartao surgir overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-xs uppercase tracking-widest text-suave">
            <tr>
              <th className="px-4 py-3 font-normal">Lead</th>
              <th className="hidden font-normal md:table-cell">Produto</th>
              <th className="font-normal">Prioridade</th>
              <th className="hidden font-normal md:table-cell">Etapa</th>
              <th className="font-normal">Status</th>
              <th className="hidden pr-4 font-normal md:table-cell">Última atividade</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr
                key={l.id}
                className="relative border-b border-borda transition-colors duration-150 last:border-0 hover:bg-superficie"
              >
                <td className="px-4 py-3">
                  {/* O after cobre a linha inteira: clicar em qualquer ponto abre a ficha. */}
                  <Link
                    className="font-medium text-white after:absolute after:inset-0 hover:text-ciano"
                    href={`/leads/${encodeURIComponent(l.id)}`}
                  >
                    {l.nome ?? l.nome_whatsapp ?? l.phone}
                  </Link>
                  <div className="text-suave">{l.empresa ?? ''}</div>
                </td>
                <td className="hidden md:table-cell">
                  {(l.servicos as string[]).map((s) => PRODUTO[s] ?? s).join(', ') || '—'}
                </td>
                <td>
                  <div className="flex flex-col items-start gap-1">
                    <SeloPrioridade temperatura={l.temperatura} />
                    <Pontuacao score={l.score} />
                  </div>
                </td>
                <td className="hidden md:table-cell">
                  <SeloEtapa etapa={l.etapa} />
                </td>
                <td>
                  <SeloStatus status={l.status_comercial} />
                </td>
                <td className="hidden pr-4 text-suave md:table-cell">{haQuanto(l.atualizado_em)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="py-10 text-center text-suave">Nenhum lead com esses filtros.</p>}
      </div>
    </div>
  )
}

function Chips({
  grupo,
  chave,
  opcoes,
  f,
}: {
  grupo: string
  chave: keyof Filtros
  opcoes: Record<string, string>
  f: Filtros
}) {
  const href = (valor: string) => {
    const q = new URLSearchParams(Object.entries({ ...f, [chave]: valor }).filter(([, v]) => v) as [string, string][])
    return q.size ? `/leads?${q}` : '/leads'
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-24 text-xs uppercase tracking-widest text-suave">{grupo}</span>
      {[['', 'Todas'], ...Object.entries(opcoes)].map(([valor, rotulo]) => (
        <Link
          key={valor}
          href={href(valor)}
          className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
            (f[chave] ?? '') === valor
              ? 'botao-primario border-transparent'
              : 'border-borda text-suave hover:border-ciano/40 hover:text-white'
          }`}
        >
          {rotulo}
        </Link>
      ))}
    </div>
  )
}
