import Link from 'next/link'
import { sql } from '@/lib/db.ts'
import { ETAPAS, STATUS_COMERCIAL } from '@/lib/tipos.ts'

export const dynamic = 'force-dynamic'

type Filtros = { temperatura?: string; etapa?: string; status?: string }

const COR_TEMPERATURA: Record<string, string> = {
  quente: 'bg-quente/15 text-quente',
  morno: 'bg-morno/15 text-morno',
  frio: 'bg-frio/15 text-frio',
}

export default async function Leads({ searchParams }: { searchParams: Promise<Filtros> }) {
  const f = await searchParams
  const temp = f.temperatura || null
  const et = f.etapa || null
  const st = f.status || null
  const leads = await sql()`select id, phone, nome_whatsapp, lead->>'nome' as nome, lead->>'empresa' as empresa,
      lead->>'porte' as porte, score, temperatura, etapa, status_comercial
    from contatos
    where (${temp}::text is null or temperatura = ${temp})
      and (${et}::text is null or etapa = ${et})
      and (${st}::text is null or status_comercial = ${st})
    order by score desc, atualizado_em desc limit 200`

  return (
    <div className="space-y-5">
      <h1 className="text-4xl font-normal tracking-[-0.066em]">Leads</h1>
      <form className="flex flex-wrap gap-2 text-sm">
        <Seletor nome="temperatura" valor={temp} opcoes={['quente', 'morno', 'frio']} />
        <Seletor nome="etapa" valor={et} opcoes={ETAPAS} />
        <Seletor nome="status" valor={st} opcoes={STATUS_COMERCIAL} />
        <button type="submit" className="botao-primario px-4 py-1.5">
          Filtrar
        </button>
      </form>
      <div className="cartao overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-borda text-suave">
            <tr>
              <th className="px-4 py-3 font-normal">Lead</th>
              <th className="font-normal">Porte</th>
              <th className="font-normal">Score</th>
              <th className="font-normal">Temperatura</th>
              <th className="font-normal">Etapa</th>
              <th className="font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-borda last:border-0 hover:bg-superficie">
                <td className="px-4 py-3">
                  <Link className="font-medium text-white hover:text-ciano" href={`/leads/${encodeURIComponent(l.id)}`}>
                    {l.nome ?? l.nome_whatsapp ?? l.phone}
                  </Link>
                  <div className="text-suave">{l.empresa ?? ''}</div>
                </td>
                <td>{l.porte ?? '—'}</td>
                <td className="tabular-nums">{l.score}</td>
                <td>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${COR_TEMPERATURA[l.temperatura] ?? ''}`}>
                    {l.temperatura}
                  </span>
                </td>
                <td>{l.etapa}</td>
                <td>{l.status_comercial}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leads.length === 0 && <p className="py-10 text-center text-suave">Nenhum lead com esses filtros.</p>}
      </div>
    </div>
  )
}

function Seletor({ nome, valor, opcoes }: { nome: string; valor: string | null; opcoes: readonly string[] }) {
  return (
    <select name={nome} defaultValue={valor ?? ''} className="rounded-full border border-borda bg-fundo px-3 py-1.5">
      <option value="">{nome}: todas</option>
      {opcoes.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  )
}
