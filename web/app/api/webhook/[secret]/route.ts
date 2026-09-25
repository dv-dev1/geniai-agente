import { after } from 'next/server'
import { acordarCerebro, consultarCerebro, transcrever } from '@/lib/cerebro.ts'
import * as db from '@/lib/db.ts'
import { receber } from '@/lib/fluxo.ts'
import { mesmoValor } from '@/lib/sessao.ts'
import { enviarTexto, lerEvento } from '@/lib/zapi.ts'

// Espera do debounce ou da transcrição (até 30 s) + cérebro (até 40 s) + send-text; o Hobby com Fluid aceita até 300.
export const maxDuration = 120

export async function POST(req: Request, { params }: { params: Promise<{ secret: string }> }) {
  const { secret } = await params
  // A Z-API não assina o webhook: o segredo no caminho é a única prova de origem.
  if (!process.env.WEBHOOK_SECRET || !mesmoValor(secret, process.env.WEBHOOK_SECRET))
    return new Response(null, { status: 404 })
  const evento = lerEvento(await req.json().catch(() => null))
  const demo = evento.tipo !== 'ignorar' && db.ehTelefoneDemo(evento.phone)
  const atender = () =>
    receber(evento, {
      db,
      cerebro: consultarCerebro,
      acordar: acordarCerebro,
      transcrever,
      enviar: enviarTexto,
      esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
      debounceMs: Number(process.env.DEBOUNCE_MS ?? 6000),
    })
  // Número de apresentação: a conversa ao vivo aparece no painel do usuário demo, junto dos leads fictícios.
  after(() => (demo ? db.comBanco(db.sqlDemo(), atender) : atender()))
  return Response.json({ ok: true })
}
