import type { Etapa, Lead, Temperatura, Turno } from './tipos.ts'

export type Pedido = { historico: Turno[]; lead: Lead; msgs_bot: number; telefone_conhecido: boolean }
export type Veredito = {
  mensagem: string
  acao: 'continuar' | 'encaminhar_humano' | 'encerrar'
  lead: Lead
  score: number
  temperatura: Temperatura
  etapa: Etapa
}

// Sem await: é só para a Vercel subir o Python antes da consulta de verdade.
export function acordarCerebro(): void {
  fetch(`${process.env.CEREBRO_URL}/saude`, { signal: AbortSignal.timeout(10_000) }).catch(() => {})
}

export async function consultarCerebro(p: Pedido): Promise<Veredito> {
  const r = await fetch(`${process.env.CEREBRO_URL}/responder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AGENTE_TOKEN}` },
    body: JSON.stringify(p),
    // Partida a frio do Python + LLM; acima disso o cliente recebe FALHA em vez de silêncio.
    signal: AbortSignal.timeout(40_000),
  })
  if (!r.ok) throw new Error(`cérebro ${r.status}: ${await r.text()}`)
  return (await r.json()) as Veredito
}
