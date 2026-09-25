import type { Audio } from './tipos.ts'

export type Evento =
  | {
      tipo: 'cliente'
      id: string
      contato: string
      phone: string
      nome: string | null
      texto: string
      audio?: Audio
    }
  | { tipo: 'humano'; id: string; contato: string; phone: string; texto: string }
  | { tipo: 'ignorar' }

type Payload = {
  type?: string
  messageId?: string
  phone?: string
  chatLid?: string | null
  senderName?: string
  fromMe?: boolean
  fromApi?: boolean
  isGroup?: boolean
  isNewsletter?: boolean
  broadcast?: boolean
  isStatusReply?: boolean
  isEdit?: boolean
  waitingMessage?: boolean
  text?: { message?: string }
  image?: { caption?: string }
  audio?: { audioUrl?: string; seconds?: number }
}

const IGNORAR: Evento = { tipo: 'ignorar' }

export function lerEvento(body: unknown): Evento {
  if (typeof body !== 'object' || body === null) return IGNORAR
  const p = body as Payload
  if (p.type !== 'ReceivedCallback' || !p.messageId) return IGNORAR
  if (p.isGroup || p.isNewsletter || p.broadcast || p.isStatusReply || p.isEdit || p.waitingMessage) return IGNORAR

  // chatLid é o id estável; phone às vezes chega como o próprio @lid, que não converte em número.
  const contato = p.chatLid || p.phone
  if (!contato) return IGNORAR
  const phone = p.phone ?? contato
  const texto = p.text?.message || p.image?.caption || (p.audio ? '[áudio]' : null)

  if (p.fromMe) {
    // fromApi marca o eco do send-text do próprio bot; sem ele, alguém respondeu pelo celular.
    if (p.fromApi) return IGNORAR
    return { tipo: 'humano', id: p.messageId, contato, phone, texto: texto ?? '[mídia]' }
  }
  if (!texto) return IGNORAR
  const audio = p.audio?.audioUrl ? { audio: { url: p.audio.audioUrl, segundos: p.audio.seconds ?? 0 } } : {}
  return { tipo: 'cliente', id: p.messageId, contato, phone, nome: p.senderName ?? null, texto, ...audio }
}

export async function enviarTexto(phone: string, message: string): Promise<string> {
  const { ZAPI_INSTANCE_ID, ZAPI_TOKEN, ZAPI_CLIENT_TOKEN } = process.env
  const url = `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Client-Token': ZAPI_CLIENT_TOKEN ?? '',
    },
    body: JSON.stringify({ phone, message }),
  })
  if (!r.ok) throw new Error(`Z-API send-text ${r.status}: ${await r.text()}`)
  const { messageId } = (await r.json()) as { messageId: string }
  return messageId
}
