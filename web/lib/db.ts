import { AsyncLocalStorage } from 'node:async_hooks'
import { type NeonQueryFunction, neon } from '@neondatabase/serverless'
import { type Etapa, type Lead, type Temperatura, TRANSCREVENDO, type Turno } from './tipos.ts'

export type NovaMensagem = {
  id: string
  contato: string
  phone: string
  nome?: string | null
  autor: Turno['autor']
  texto: string
  custo_usd?: number
}
export type Contato = {
  id: string
  phone: string
  lead: Lead
  pausado: boolean
  msgsBot: number
  ociosa: boolean
  encerrada: boolean
  encaminhado: boolean
  avisada: boolean
}

export const MINUTOS_SESSAO = 30

let conexao: NeonQueryFunction<false, false> | undefined
// Banco da requisição: o webhook troca para o fictício quando a mensagem vem de um número de apresentação.
const bancoDaVez = new AsyncLocalStorage<NeonQueryFunction<false, false>>()
// Preguiçoso: o next build importa este módulo sem DATABASE_URL.
export function sql(): NeonQueryFunction<false, false> {
  conexao ??= neon(process.env.DATABASE_URL ?? '')
  return bancoDaVez.getStore() ?? conexao
}
export const comBanco = <T>(banco: NeonQueryFunction<false, false>, f: () => T): T => bancoDaVez.run(banco, f)

// Sem o nono dígito: a Z-API às vezes manda 5583 8746-8188 para quem digitou 5583 98746-8188.
const semNonoDigito = (d: string) => (d.length === 13 && d.startsWith('55') ? d.slice(0, 4) + d.slice(5) : d)

export function ehTelefoneDemo(phone: string, lista = process.env.DEMO_TELEFONES): boolean {
  if (!lista || phone.includes('@')) return false
  const alvo = semNonoDigito(phone.replace(/\D/g, ''))
  return lista.split(',').some((t) => semNonoDigito(t.replace(/\D/g, '')) === alvo)
}

let conexaoDemo: NeonQueryFunction<false, false> | undefined
export function sqlDemo() {
  // Sem banco demo configurado, falha: cair no DATABASE_URL mostraria os leads reais ao usuário de apresentação.
  if (!process.env.DEMO_DATABASE_URL) throw new Error('DEMO_DATABASE_URL não configurado')
  conexaoDemo ??= neon(process.env.DEMO_DATABASE_URL)
  return conexaoDemo
}

export async function registrarMensagem(m: NovaMensagem): Promise<boolean> {
  // Um @lid que chega depois não apaga o telefone real que a equipe precisa para ligar.
  await sql()`insert into contatos (id, phone, nome_whatsapp) values (${m.contato}, ${m.phone}, ${m.nome ?? null})
    on conflict (id) do update set
      phone = case when excluded.phone like '%@lid' then contatos.phone else excluded.phone end,
      nome_whatsapp = coalesce(excluded.nome_whatsapp, contatos.nome_whatsapp)`
  const r = await sql()`insert into mensagens (id, contato_id, autor, texto, respondida, custo_usd)
    values (${m.id}, ${m.contato}, ${m.autor}, ${m.texto}, ${m.autor !== 'cliente'}, ${m.custo_usd ?? 0})
    on conflict (id) do nothing returning id`
  return r.length > 0
}

export async function salvarTranscricao(id: string, texto: string, custo_usd: number): Promise<void> {
  await sql()`update mensagens set texto = ${texto}, custo_usd = ${custo_usd} where id = ${id}`
}

export async function transcrevendo(contato: string): Promise<boolean> {
  // Só o último minuto: se a gravação da transcrição falhar, a marca que ficou não trava o contato para sempre.
  const r = await sql()`select 1 from mensagens where contato_id = ${contato} and texto = ${TRANSCREVENDO}
    and criado_em > now() - interval '1 minute' limit 1`
  return r.length > 0
}

export async function ultimaDoCliente(contato: string): Promise<string | null> {
  const r = await sql()`select id from mensagens where contato_id = ${contato} and autor = 'cliente'
    order by criado_em desc limit 1`
  return (r[0]?.id as string | undefined) ?? null
}

export async function reivindicarPendentes(contato: string): Promise<number> {
  const r = await sql()`update mensagens set respondida = true
    where contato_id = ${contato} and autor = 'cliente' and not respondida returning id`
  return r.length
}

export async function historico(contato: string, limite = 40): Promise<Turno[]> {
  const r = await sql()`select autor, texto from (
      select m.autor, m.texto, m.criado_em from mensagens m join contatos c on c.id = m.contato_id
      where m.contato_id = ${contato} and m.criado_em >= c.sessao_inicio order by m.criado_em desc limit ${limite}
    ) t order by criado_em`
  return r as Turno[]
}

export async function carregarContato(id: string): Promise<Contato> {
  const [c] = await sql()`select c.id, c.phone, c.lead, c.pausado_ate > now() as pausado,
      c.encerrada_em is not null as encerrada, c.etapa = 'encaminhado' as encaminhado,
      exists (select 1 from mensagens m where m.contato_id = c.id and m.autor = 'bot'
        and m.criado_em > c.encerrada_em) as avisada,
      coalesce((select max(criado_em) from mensagens m where m.contato_id = c.id and m.respondida)
        < now() - make_interval(mins => ${MINUTOS_SESSAO}), false) as ociosa,
      (select count(*)::int from mensagens m where m.contato_id = c.id and m.autor = 'bot'
        and m.criado_em >= c.sessao_inicio) as msgs_bot
    from contatos c where c.id = ${id}`
  return {
    id: c.id,
    phone: c.phone,
    lead: c.lead,
    pausado: c.pausado === true,
    msgsBot: c.msgs_bot,
    ociosa: c.ociosa,
    encerrada: c.encerrada,
    encaminhado: c.encaminhado,
    avisada: c.avisada,
  }
}

export async function salvarLead(id: string, lead: Lead, score: number, temp: Temperatura, et: Etapa): Promise<void> {
  await sql()`update contatos set lead = ${JSON.stringify(lead)}::jsonb, score = ${score}, temperatura = ${temp},
    etapa = ${et}, atualizado_em = now() where id = ${id}`
}

export async function pausar(id: string, horas: number): Promise<void> {
  await sql()`update contatos set pausado_ate = now() + make_interval(hours => ${horas}) where id = ${id}`
}

// A sessão nova começa na primeira mensagem ainda sem resposta, para o histórico dela entrar inteiro.
export async function abrirSessao(id: string): Promise<void> {
  await sql()`update contatos set encerrada_em = null, sessao_inicio = coalesce((select min(criado_em) from mensagens
      where contato_id = ${id} and autor = 'cliente' and not respondida), now()) where id = ${id}`
}

export async function encerrar(id: string, encaminhado: boolean): Promise<void> {
  await sql()`update contatos set encerrada_em = now(),
    etapa = case when ${encaminhado} then 'encaminhado' else etapa end where id = ${id}`
}
