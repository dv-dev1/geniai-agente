import { revalidatePath } from 'next/cache'
import { notFound } from 'next/navigation'
import { Fragment } from 'react'
import { linkWhatsApp, mensagemDoEspecialista } from '@/lib/abordagem.ts'
import { MINUTOS_SESSAO, sql } from '@/lib/db.ts'
import { STATUS_COMERCIAL } from '@/lib/tipos.ts'

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

export default async function FichaLead({ params }: { params: Promise<{ id: string }> }) {
  const id = decodeURIComponent((await params).id)
  const [c] = await sql()`select * from contatos where id = ${id}`
  if (!c) notFound()
  const mensagens =
    await sql()`select id, autor, texto, criado_em from mensagens where contato_id = ${id} order by criado_em`
  const lead = c.lead as Record<string, unknown>
  const telefone = /^\d+$/.test(c.phone) ? c.phone : (lead.telefone as string | null)

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_1.4fr]">
      <section className="cartao space-y-4 p-5">
        <h1 className="text-3xl font-normal tracking-[-0.05em] text-white">
          {(lead.nome as string) ?? c.nome_whatsapp ?? c.phone}
        </h1>
        <p className="text-sm text-suave">
          {c.temperatura} · score {c.score} · {c.etapa}
          {telefone && (
            <>
              {' · '}
              <a className="text-ciano" href={`https://wa.me/${telefone.replace(/\D/g, '')}`}>
                {telefone}
              </a>
            </>
          )}
        </p>
        {telefone && (
          <a
            className="botao-primario inline-block px-5 py-2 text-sm text-white"
            href={linkWhatsApp(telefone, mensagemDoEspecialista(lead, c.nome_whatsapp))}
            target="_blank"
            rel="noopener"
          >
            Chamar no WhatsApp
          </a>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {Object.entries(lead).map(([campo, valor]) => (
            <div key={campo} className="contents">
              <dt className="text-suave">{campo}</dt>
              <dd>{Array.isArray(valor) ? valor.join(', ') || '—' : String(valor ?? '—')}</dd>
            </div>
          ))}
        </dl>
        <form action={mudarStatus} className="flex gap-2 text-sm">
          <input type="hidden" name="id" value={id} />
          <select
            name="status"
            defaultValue={c.status_comercial}
            className="rounded-full border border-borda bg-fundo px-3 py-1.5"
          >
            {STATUS_COMERCIAL.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <button type="submit" className="botao-primario px-4 py-1.5">
            Salvar status
          </button>
        </form>
      </section>
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
