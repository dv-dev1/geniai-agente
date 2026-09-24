import assert from 'node:assert/strict'
import { test } from 'node:test'
import { consultarCerebro } from '../lib/cerebro.ts'

const pedido = {
  historico: [{ autor: 'cliente' as const, texto: 'oi' }],
  lead: {},
  msgs_bot: 0,
  telefone_conhecido: true,
}

test('consultarCerebro manda Bearer e o pedido para /responder', async (t) => {
  process.env.CEREBRO_URL = 'https://cerebro.test'
  process.env.AGENTE_TOKEN = 'tok'
  const chamadas: [string, RequestInit][] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    chamadas.push([url, init])
    return Response.json({ mensagem: 'olá', acao: 'continuar', lead: {}, score: 0, temperatura: 'frio', etapa: 'novo' })
  })
  assert.equal((await consultarCerebro(pedido)).mensagem, 'olá')
  const [url, init] = chamadas[0]
  assert.equal(url, 'https://cerebro.test/responder')
  assert.equal((init.headers as Record<string, string>).Authorization, 'Bearer tok')
  assert.deepEqual(JSON.parse(String(init.body)), pedido)
})

test('consultarCerebro falha alto em 401', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 401 }))
  await assert.rejects(consultarCerebro(pedido), /cérebro 401/)
})
