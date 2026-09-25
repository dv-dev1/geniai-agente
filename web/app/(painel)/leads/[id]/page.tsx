import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'
import { linkWhatsApp, mensagemDoEspecialista } from '@/lib/abordagem.ts'
import { MINUTOS_SESSAO, sql } from '@/lib/db.ts'
import { PLANO, PORTE, PRODUTO, STATUS, URGENCIA } from '@/lib/rotulos.ts'
import { type Lead, STATUS_COMERCIAL } from '@/lib/tipos.ts'
import { Pontuacao, Selo, SeloEtapa, SeloPrioridade } from '../../ui.tsx'

export const dynamic = 'force-dynamic'

const novaSessao = (antes: string, depois: string) =>
  new Date(depois).getTime() - new Date(antes).getTime() > MINUTOS_SESSAO * 60_000

async function mudarStatus(form: FormData) {
  'use server'
  const id = String(form.get('id'))
  const status = String(form.get('status'))
  if (!(STATUS_COMERCIAL as readonly string[]).includes(status)) throw new Error(`status inválido: ${status}`)
  await sql()`update contatos set status_comercial = ${status} where id = ${id}`
  revalidatePath(`/leads/${encodeURIComponent(id)}`)
}

type Campo = [rotulo: string, valor: string | null]

// O que o especialista precisa saber antes de ligar; é também o que a Gê tem de levantar na conversa.
function informacoes(lead: Lead): [grupo: string, campos: Campo[]][] {
  const servicos = (lead.servicos as string[] | undefined) ?? []
  const pessoas = lead.colaboradores == null ? null : `${lead.colaboradores} pessoas`
  const tamanho = [PORTE[lead.porte as string], pessoas].filter(Boolean).join(' · ') || null
  const soDisparador = servicos.length === 1 && servicos[0] === 'disparador'
  const base = lead.base_clientes == null ? null : `${(lead.base_clientes as number).toLocaleString('pt-BR')} contatos`
  const decisor = lead.decisor == null ? null : lead.decisor ? 'É quem decide' : 'Depende de outra pessoa'
  return [
    [
      'Empresa',
      [
        ['Empresa', (lead.empresa as string) ?? null],
        ['Tamanho', tamanho],
        ['Cidade', (lead.cidade as string) ?? null],
      ],
    ],
    [
      'Necessidade',
      [
        ['Necessidade', (lead.dor as string) ?? null],
        ['Produto', servicos.map((s) => PRODUTO[s] ?? s).join(' e ') || null],
        soDisparador ? ['Base de clientes', base] : ['Plano', PLANO[lead.plano as string] ?? null],
      ],
    ],
    [
      'Decisão',
      [
        ['Prazo', URGENCIA[lead.urgencia as string] ?? null],
        ['Quem decide', decisor],
      ],
    ],
  ]
}

export default async function FichaLead({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const [c] = await sql()`select * from contatos where id = ${id}`
  if (!c) notFound()
  const mensagens =
    await sql()`select id, autor, texto, criado_em from mensagens where contato_id = ${id} order by criado_em`
  const lead = c.lead as Lead
  const telefone = /^\d+$/.test(c.phone) ? c.phone : (lead.telefone as string | null)
  const grupos = informacoes(lead)
  const campos = grupos.flatMap(([, cs]) => cs)
  const coletados = campos.filter(([, v]) => v).length

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <div className="space-y-4">
        <section className="cartao surgir space-y-4 p-5">
          <div className="space-y-3">
            <h1 className="titulo-gradiente text-3xl font-medium tracking-[-0.05em]">
              {(lead.nome as string) ?? c.nome_whatsapp ?? c.phone}
            </h1>
            <div className="flex flex-wrap items-center gap-2">
              <SeloPrioridade temperatura={c.temperatura} />
              <SeloEtapa etapa={c.etapa} />
              {lead.pediu_contato === true && <Selo cor="border-ciano/40 text-ciano">Pediu contato</Selo>}
              {lead.fora_do_perfil === true && <Selo cor="border-borda text-suave">Fora do perfil</Selo>}
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <Pontuacao score={c.score} />
              {telefone && (
                <a className="text-ciano hover:underline" href={`https://wa.me/${telefone.replace(/\D/g, '')}`}>
                  {telefone}
                </a>
              )}
            </div>
          </div>
          {telefone && (
            <a
              className="botao-primario inline-block px-5 py-2 text-sm text-white transition-[filter] duration-150 hover:brightness-110"
              href={linkWhatsApp(telefone, mensagemDoEspecialista(lead, c.nome_whatsapp))}
              target="_blank"
              rel="noopener"
            >
              Chamar no WhatsApp
            </a>
          )}
        </section>

        <section className="cartao surgir p-5">
          <h2 className="mb-2 text-xs uppercase tracking-widest text-suave">Resumo da conversa</h2>
          {lead.resumo ? (
            <p className="text-sm leading-relaxed">{lead.resumo as string}</p>
          ) : (
            <p className="text-sm text-suave">O resumo aparece a partir da próxima conversa deste lead.</p>
          )}
        </section>

        <section className="cartao surgir space-y-4 p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs uppercase tracking-widest text-suave">Informações coletadas</h2>
            <span className="flex items-center gap-2 text-xs text-suave">
              <span className="h-1 w-16 rounded-full bg-superficie">
                <span
                  className="gradiente-marca block h-1 rounded-full"
                  style={{ width: `${(coletados / campos.length) * 100}%` }}
                />
              </span>
              {coletados} de {campos.length}
            </span>
          </div>
          {grupos.map(([grupo, cs]) => (
            <div key={grupo}>
              <h3 className="mb-1.5 text-sm font-medium text-white">{grupo}</h3>
              <dl className="grid grid-cols-[7.5rem_1fr] gap-x-4 gap-y-1.5 text-sm">
                {cs.map(([rotulo, valor]) => (
                  <Fragment key={rotulo}>
                    <dt className="text-suave">{rotulo}</dt>
                    <dd className={valor ? 'first-letter:uppercase' : 'text-suave/50'}>{valor ?? 'Não informado'}</dd>
                  </Fragment>
                ))}
              </dl>
            </div>
          ))}
        </section>

        <form action={mudarStatus} className="cartao surgir p-5">
          <input type="hidden" name="id" value={id} />
          <h2 className="mb-3 text-xs uppercase tracking-widest text-suave">Status comercial</h2>
          <div className="flex flex-wrap gap-1.5">
            {STATUS_COMERCIAL.map((s) => (
              <button
                key={s}
                type="submit"
                name="status"
                value={s}
                className={`rounded-full border px-3 py-1 text-xs transition-colors duration-150 ${
                  c.status_comercial === s
                    ? 'botao-primario border-transparent'
                    : 'border-borda text-suave hover:border-ciano/40 hover:text-white'
                }`}
              >
                {STATUS[s]}
              </button>
            ))}
          </div>
        </form>
      </div>

      <section className="space-y-2">
        <h2 className="font-medium">Conversa</h2>
        {mensagens.map((m, i) => (
          <Fragment key={m.id}>
            {i > 0 && novaSessao(mensagens[i - 1].criado_em, m.criado_em) && (
              <div className="py-2 text-center text-[10px] uppercase tracking-wide text-suave">
                nova sessão · {new Date(m.criado_em).toLocaleString('pt-BR', { timeZone: 'America/Fortaleza' })}
              </div>
            )}
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl p-3 text-sm ${
                m.autor === 'cliente' ? 'cartao' : 'ml-auto border border-ciano/30 bg-ciano/10'
              }`}
            >
              <div className="mb-1 text-[10px] uppercase tracking-wide text-suave">{m.autor}</div>
              {m.texto}
            </div>
          </Fragment>
        ))}
      </section>
    </div>
  )
}
