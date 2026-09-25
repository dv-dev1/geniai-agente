import { sql } from '@/lib/db.ts'
import { funil, PRIORIDADE } from '@/lib/rotulos.ts'
import { Cabecalho } from './ui.tsx'

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
  const f = funil(Object.fromEntries(etapas.map((e) => [e.etapa, e.n])))
  const topoFunil = Math.max(1, f.degraus[0].n)
  const maxDia = Math.max(1, ...dias.map((d) => d.n as number))
  const msgsPorConversa = m.conversas ? (m.bot / m.conversas).toFixed(1) : '—'
  // Simulação: a GeniAI não usa a API oficial aqui, e a franquia grátis fica de fora para o número mostrar o custo real das mensagens.
  const custoMeta = m.empresa_mes * PRECO_MENSAGEM_META

  return (
    <div className="space-y-8">
      <Cabecalho
        titulo="Visão geral"
        descricao={`${t.leads} ${t.leads === 1 ? 'lead atendido' : 'leads atendidos'} pela Gê no WhatsApp`}
      />

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Cartao rotulo="Leads" valor={t.leads} />
        <Cartao rotulo="Prioridade alta" valor={t.quente} destaque />
        <Cartao rotulo="Msgs do bot por conversa" valor={msgsPorConversa} />
        <Cartao
          rotulo={`Custo simulado na API oficial (mês) · ${m.empresa_mes} msgs × R$ 0,035`}
          valor={custoMeta.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <section className="cartao surgir p-5">
          <h2 className="font-medium">Funil de atendimento</h2>
          <p className="mb-5 text-xs text-suave">
            Leads que chegaram até cada etapa · % sobre a etapa anterior; a primeira é a base
          </p>
          {f.degraus.map((d, i) => (
            <div key={d.rotulo} className="mb-2 grid grid-cols-[10.5rem_1fr_4.5rem] items-center gap-3 text-sm">
              <span className="text-suave">{d.rotulo}</span>
              <div className="flex h-7 justify-center">
                <div
                  className="gradiente-marca crescer-x h-full rounded-md"
                  style={{
                    width: `${Math.max(1.5, (d.n / topoFunil) * 100)}%`,
                    opacity: 1 - i * 0.13,
                    animationDelay: `${i * 70}ms`,
                  }}
                />
              </div>
              <span className="text-right tabular-nums">
                <span className="text-white">{d.n}</span>
                <span className="ml-1.5 text-xs text-suave">{d.conversao}%</span>
              </span>
            </div>
          ))}
          {f.foraDoPerfil > 0 && <p className="mt-4 text-xs text-suave">Fora do perfil: {f.foraDoPerfil}</p>}
        </section>

        <section className="cartao surgir p-5">
          <h2 className="font-medium">Prioridade</h2>
          <p className="mb-5 text-xs text-suave">Pela pontuação que a Gê calcula na conversa</p>
          <Rosca
            total={t.leads}
            fatias={['quente', 'morno', 'frio'].map((k) => ({
              rotulo: PRIORIDADE[k],
              n: t[k] as number,
              cor: `var(--color-${k})`,
            }))}
          />
        </section>
      </div>

      <section className="cartao surgir p-5">
        <h2 className="mb-4 font-medium">Novos leads · 14 dias</h2>
        <div className="flex h-44 items-end gap-1 pt-8">
          {dias.map((d, i) => (
            <div key={d.dia} className="group relative flex h-full flex-1 flex-col items-center justify-end gap-1">
              <span className="pointer-events-none absolute -top-7 z-10 whitespace-nowrap rounded-md border border-borda bg-[#0b1d28] px-2 py-0.5 text-xs text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                {d.n} {d.n === 1 ? 'lead' : 'leads'} · {d.dia}
              </span>
              <div
                className="gradiente-marca crescer w-full rounded-t transition-[filter] duration-150 group-hover:brightness-125"
                style={{ height: d.n ? `${(d.n / maxDia) * 100}%` : '2px', animationDelay: `${i * 25}ms` }}
              />
              <span className="text-[10px] text-suave transition-colors duration-150 group-hover:text-white">
                {d.dia}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function Cartao({ rotulo, valor, destaque }: { rotulo: string; valor: string | number; destaque?: boolean }) {
  return (
    <div className={`cartao surgir p-4 ${destaque ? 'border-quente/40' : ''}`}>
      <div className={`text-3xl font-normal tracking-[-0.05em] ${destaque ? 'text-quente' : 'text-white'}`}>
        {valor}
      </div>
      <div className="mt-1 text-sm text-suave">{rotulo}</div>
    </div>
  )
}

function Rosca({ total, fatias }: { total: number; fatias: { rotulo: string; n: number; cor: string }[] }) {
  let inicio = 0
  const partes = fatias.map((f) => {
    const fim = inicio + (total ? (f.n / total) * 100 : 0)
    const parte = `${f.cor} ${inicio}% ${fim}%`
    inicio = fim
    return parte
  })
  return (
    <div className="flex items-center gap-6">
      <div className="relative size-36 shrink-0">
        <div
          className="size-full rounded-full"
          style={{
            background: total ? `conic-gradient(${partes.join(', ')})` : 'var(--color-borda)',
            mask: 'radial-gradient(farthest-side, transparent 70%, #000 71%)',
            WebkitMask: 'radial-gradient(farthest-side, transparent 70%, #000 71%)',
          }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl tracking-[-0.05em] text-white">{total}</span>
          <span className="text-xs text-suave">leads</span>
        </div>
      </div>
      <ul className="space-y-2.5 text-sm">
        {fatias.map((f) => (
          <li key={f.rotulo} className="flex items-center gap-2">
            <span className="size-2 rounded-full" style={{ background: f.cor }} />
            <span className="w-14">{f.rotulo}</span>
            <span className="w-6 text-right tabular-nums text-white">{f.n}</span>
            <span className="text-xs text-suave">{total ? Math.round((f.n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
