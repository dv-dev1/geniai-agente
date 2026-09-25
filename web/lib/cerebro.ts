import type { Audio, Etapa, Lead, Temperatura, Turno } from './tipos.ts'

export type Transcricao = { texto: string; custo_usd: number }
export type Pedido = { historico: Turno[]; lead: Lead; msgs_bot: number; telefone_conhecido: boolean }
export type Veredito = {
  mensagem: string
  acao: 'continuar' | 'encaminhar_humano' | 'encerrar'
  lead: Lead
  score: number
  temperatura: Temperatura
  etapa: Etapa
  custo_usd?: number
}

// Sem await: é só para a Vercel subir o Python antes da consulta de verdade.
export function acordarCerebro(): void {
  fetch(`${process.env.CEREBRO_URL}/saude`, { signal: AbortSignal.timeout(10_000) }).catch(() => {})
}

async function chamar<T>(rota: string, corpo: unknown, ms: number): Promise<T> {
  const r = await fetch(`${process.env.CEREBRO_URL}${rota}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AGENTE_TOKEN}` },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(ms),
  })
  if (!r.ok) throw new Error(`cérebro ${r.status}: ${await r.text()}`)
  return (await r.json()) as T
}

// Partida a frio do Python + LLM; acima disso o cliente recebe FALHA em vez de silêncio.
export const consultarCerebro = (p: Pedido) => chamar<Veredito>('/responder', p, 40_000)

export const transcrever = (a: Audio) => chamar<Transcricao>('/transcrever', a, 30_000)
