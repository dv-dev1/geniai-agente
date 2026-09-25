import { sql } from '@/lib/db.ts'
import { ETAPAS } from '@/lib/tipos.ts'

export const dynamic = 'force-dynamic'

const PRECO_MENSAGEM_META = 0.035

export default async function VisaoGeral() {
  const db = sql()
  const [[t], etapas, [m], dias] = await Promise.all([
    db`select count(*)::int as leads,
        count(*) filter (where temperatura = 'quente')::int as quente,
        count(*) filter (where temperatura = 'morno')::int as morno,
        count(*) filter (where temperatura = 'frio')::int as frio
      from contatos`,
    db`select etapa, count(*)::int as n from contatos group by etapa`,
    db`select count(*) filter (where autor = 'bot')::int as bot,
        count(distinct contato_id) filter (where autor = 'bot')::int as conversas,
        count(*) filter (where autor <> 'cliente' and criado_em >= date_trunc('month', now()))::int as empresa_mes
      from mensagens`,
    db`select to_char(d, 'DD/MM') as dia, count(c.id)::int as n
      from generate_series((now() at time zone 'America/Fortaleza')::date - 13,
                           (now() at time zone 'America/Fortaleza')::date, interval '1 day') d
      left join contatos c on (c.criado_em at time zone 'America/Fortaleza')::date = d::date
      group by d order by d`,
  ])
  const porEtapa: Record<string, number> = Object.fromEntries(etapas.map((e) => [e.etapa, e.n]))
  const maxEtapa = Math.max(1, ...Object.values(porEtapa))
  const maxDia = Math.max(1, ...dias.map((d) => d.n as number))
  const msgsPorConversa = m.conversas ? (m.bot / m.conversas).toFixed(1) : '—'
  // Simulação: a GeniAI não usa a API oficial aqui, e a franquia grátis fica de fora para o número mostrar o custo real das mensagens.
  const custoMeta = m.empresa_mes * PRECO_MENSAGEM_META

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-normal tracking-[-0.066em] sm:text-5xl">Leads da GeniAI</h1>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo="Leads" valor={t.leads} />
        <Cartao rotulo="Quentes" valor={t.quente} destaque />
        <Cartao rotulo="Msgs do bot por conversa" valor={msgsPorConversa} />
        <Cartao
          rotulo={`Custo simulado na API oficial (mês) · ${m.empresa_mes} msgs × R$ 0,035`}
          valor={custoMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Funil</h2>
        {ETAPAS.map((e) => (
          <Barra key={e} rotulo={e} n={porEtapa[e] ?? 0} max={maxEtapa} cor="gradiente-marca" />
        ))}
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Temperatura</h2>
        <Barra rotulo="quente" n={t.quente} max={Math.max(1, t.leads)} cor="bg-quente" />
        <Barra rotulo="morno" n={t.morno} max={Math.max(1, t.leads)} cor="bg-morno" />
        <Barra rotulo="frio" n={t.frio} max={Math.max(1, t.leads)} cor="bg-frio" />
      </section>

      <section className="cartao p-5">
        <h2 className="mb-4 font-medium">Novos leads · 14 dias</h2>
        <div className="flex h-36 items-end gap-1">
          {dias.map((d) => (
            <div
              key={d.dia}
              className="flex h-full flex-1 flex-col items-center justify-end gap-1"
              title={`${d.dia}: ${d.n}`}
            >
              <div className="gradiente-marca w-full rounded-t" style={{ height: `${(d.n / maxDia) * 100}%` }} />
              <span className="text-[10px] text-suave">{d.dia}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className={`cartao p-4 ${destaque ? 'border-quente/40' : ''}`}>
      <div className={`text-3xl font-normal tracking-[-0.05em] ${destaque ? 'text-quente' : 'text-white'}`}>
        {valor}
      </div>
      <div className="mt-1 text-sm text-suave">{rotulo}</div>
    </div>
  )
}

function Barra({ rotulo, n, max, cor }: { rotulo: string; n: number; max: number; cor: string }) {
  return (
    <div className="mb-2 flex items-center gap-3 text-sm">
      <span className="w-28 shrink-0 text-suave">{rotulo}</span>
      <div className="h-2.5 flex-1 rounded-full bg-superficie">
        <div className={`h-2.5 rounded-full ${cor}`} style={{ width: `${(n / max) * 100}%` }} />
      </div>
      <span className="w-8 text-right tabular-nums">{n}</span>
    </div>
  )
}
