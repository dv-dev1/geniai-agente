import type { consultarCerebro, transcrever, Veredito } from './cerebro.ts'
import type * as banco from './db.ts'
import type { Contato } from './db.ts'
import { AUDIO_SEM_TEXTO, type Audio, PREFIXO_AUDIO, TRANSCREVENDO } from './tipos.ts'
import type { Evento } from './zapi.ts'

export type Deps = {
  db: Omit<typeof banco, 'sql' | 'sqlDemo' | 'comBanco' | 'ehTelefoneDemo' | 'MINUTOS_SESSAO'>
  cerebro: typeof consultarCerebro
  acordar: () => void
  transcrever: typeof transcrever
  enviar: (phone: string, texto: string) => Promise<string>
  esperar: (ms: number) => Promise<void>
  debounceMs: number
}

export const HORAS_PAUSA = 24
export const FALHA =
  'Tive um problema técnico aqui. Um especialista da GeniAI vai continuar seu atendimento; o time responde das 8h às 17h.'
export const AVISO_ENCAMINHADO = 'Sua conversa já está com um especialista da GeniAI; ele responde das 8h às 17h.'
const ESPERA_TRANSCRICAO_S = 45

export async function receber(e: Evento, d: Deps): Promise<void> {
  if (e.tipo === 'ignorar') return
  const nova = await d.db.registrarMensagem({
    id: e.id,
    contato: e.contato,
    phone: e.phone,
    nome: e.tipo === 'cliente' ? e.nome : null,
    autor: e.tipo,
    texto: e.tipo === 'cliente' && e.audio ? TRANSCREVENDO : e.texto,
  })
  if (!nova) return
  if (e.tipo === 'humano') return d.db.pausar(e.contato, HORAS_PAUSA)

  d.acordar()
  // A mensagem já está gravada: transcrever junto com a espera não muda a ordem da conversa.
  await Promise.all([e.audio && ouvir(e.id, e.audio, d), d.esperar(d.debounceMs)])
  await esperarTranscricoes(e.contato, d)
  // Chegou outra mensagem durante as esperas: quem responde é a espera dela.
  if ((await d.db.ultimaDoCliente(e.contato)) !== e.id) return
  await atender(e.contato, d)
}

// Na falha ou no áudio mudo fica "[áudio]", e a Gê pede para a pessoa escrever.
async function ouvir(id: string, audio: Audio, d: Deps): Promise<void> {
  const t = await d.transcrever(audio).catch((erro) => {
    console.error('transcrição falhou', id, erro)
    return { texto: '', custo_usd: 0 }
  })
  // Se o banco falhar aqui, a marca expira sozinha; a resposta ao cliente não pode cair junto.
  await d.db
    .salvarTranscricao(id, t.texto ? PREFIXO_AUDIO + t.texto : AUDIO_SEM_TEXTO, t.custo_usd)
    .catch((erro) => console.error('transcrição não gravada', id, erro))
}

// Um texto que chega logo depois de um áudio não pode ser respondido antes de o áudio virar texto.
async function esperarTranscricoes(contatoId: string, d: Deps): Promise<void> {
  for (let s = 0; s < ESPERA_TRANSCRICAO_S && (await d.db.transcrevendo(contatoId)); s++) await d.esperar(1000)
}

async function atender(contatoId: string, d: Deps): Promise<void> {
  const c = await d.db.carregarContato(contatoId)
  if (c.pausado) {
    // O atendente já tratou estas mensagens; sem marcar, a próxima sessão do bot as leria de novo.
    await d.db.reivindicarPendentes(contatoId)
    return
  }
  if (c.ociosa) await d.db.abrirSessao(contatoId)
  // Reivindicação atômica: se outra execução já pegou estas mensagens, esta desiste.
  if ((await d.db.reivindicarPendentes(contatoId)) === 0) return
  if (c.encerrada && !c.ociosa) return avisarEncaminhado(c, d)

  let v: Veredito | null = null
  try {
    v = await d.cerebro({
      historico: await d.db.historico(contatoId),
      lead: c.lead,
      msgs_bot: c.ociosa ? 0 : c.msgsBot,
      telefone_conhecido: !c.phone.endsWith('@lid'),
    })
  } catch (erro) {
    console.error('cérebro falhou', contatoId, erro)
  }

  // Antes do envio: se a Z-API falhar, o que o cérebro qualificou não se perde.
  if (v) await d.db.salvarLead(contatoId, v.lead, v.score, v.temperatura, v.etapa)
  const texto = v?.mensagem ?? FALHA
  // ponytail: se o send-text falhar, as mensagens já foram reivindicadas e ficam sem resposta; reenfileirar quando a Z-API falhar de verdade.
  const id = await d.enviar(c.phone, texto)
  await d.db.registrarMensagem({ id, contato: contatoId, phone: c.phone, autor: 'bot', texto, custo_usd: v?.custo_usd })
  // A falha também promete um especialista; o painel precisa mostrar esse lead como encaminhado.
  if (v?.acao !== 'continuar') await d.db.encerrar(contatoId, !v || v.acao === 'encaminhar_humano')
}

// Uma vez por sessão: o cliente sabe que foi ouvido; mais que isso só gastaria mensagem paga.
async function avisarEncaminhado(c: Contato, d: Deps): Promise<void> {
  if (!c.encaminhado || c.avisada) return
  const id = await d.enviar(c.phone, AVISO_ENCAMINHADO)
  await d.db.registrarMensagem({ id, contato: c.id, phone: c.phone, autor: 'bot', texto: AVISO_ENCAMINHADO })
}
