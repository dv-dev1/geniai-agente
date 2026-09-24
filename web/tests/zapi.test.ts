import assert from 'node:assert/strict'
import { test } from 'node:test'
import { enviarTexto, lerEvento } from '../lib/zapi.ts'

const base = {
  type: 'ReceivedCallback',
  messageId: 'M1',
  phone: '5583999990000',
  chatLid: '111@lid',
  senderName: 'Ana',
  fromMe: false,
  fromApi: false,
  isGroup: false,
  isNewsletter: false,
  broadcast: false,
  isStatusReply: false,
  isEdit: false,
  waitingMessage: false,
  text: { message: 'oi' },
}
const { text: _texto, ...semTexto } = base

test('texto do cliente usa chatLid como contato e guarda o telefone', () => {
  assert.deepEqual(lerEvento(base), {
    tipo: 'cliente',
    id: 'M1',
    contato: '111@lid',
    phone: '5583999990000',
    nome: 'Ana',
    texto: 'oi',
  })
})

test('sem chatLid o contato é o phone', () => {
  const e = lerEvento({ ...base, chatLid: null })
  assert.equal(e.tipo === 'cliente' && e.contato, '5583999990000')
})

test('grupo, newsletter, lista, resposta de status, edição e mensagem aguardando são ignorados', () => {
  for (const flag of ['isGroup', 'isNewsletter', 'broadcast', 'isStatusReply', 'isEdit', 'waitingMessage']) {
    assert.equal(lerEvento({ ...base, [flag]: true }).tipo, 'ignorar', flag)
  }
})

test('eco do que o próprio bot enviou é ignorado', () => {
  assert.equal(lerEvento({ ...base, fromMe: true, fromApi: true }).tipo, 'ignorar')
})

test('mensagem digitada no celular da empresa é humano, com texto ou mídia', () => {
  assert.equal(lerEvento({ ...base, fromMe: true, text: { message: 'Oi, aqui é o Pedro' } }).tipo, 'humano')
  assert.equal(lerEvento({ ...semTexto, fromMe: true, image: { imageUrl: 'x' } }).tipo, 'humano')
})

test('áudio do cliente vira [áudio] e legenda de imagem vira texto', () => {
  const audio = lerEvento({ ...semTexto, audio: { ptt: true, audioUrl: 'x' } })
  const imagem = lerEvento({ ...semTexto, image: { caption: 'meu cardápio' } })
  assert.equal(audio.tipo === 'cliente' && audio.texto, '[áudio]')
  assert.equal(imagem.tipo === 'cliente' && imagem.texto, 'meu cardápio')
})

test('figurinha, outro tipo de callback e corpo inválido são ignorados', () => {
  assert.equal(lerEvento({ ...semTexto, sticker: { stickerUrl: 'x' } }).tipo, 'ignorar')
  assert.equal(lerEvento({ ...base, type: 'MessageStatusCallback' }).tipo, 'ignorar')
  assert.equal(lerEvento(null).tipo, 'ignorar')
  assert.equal(lerEvento('lixo').tipo, 'ignorar')
})

test('enviarTexto chama send-text com Client-Token e devolve o messageId', async (t) => {
  process.env.ZAPI_INSTANCE_ID = 'INST'
  process.env.ZAPI_TOKEN = 'TOK'
  process.env.ZAPI_CLIENT_TOKEN = 'SEG'
  const chamadas: [string, RequestInit][] = []
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    chamadas.push([url, init])
    return Response.json({ zaapId: 'Z', messageId: 'ENV1', id: 'ENV1' })
  })
  assert.equal(await enviarTexto('5583999990000', 'olá'), 'ENV1')
  const [url, init] = chamadas[0]
  assert.equal(url, 'https://api.z-api.io/instances/INST/token/TOK/send-text')
  assert.equal((init.headers as Record<string, string>)['Client-Token'], 'SEG')
  assert.deepEqual(JSON.parse(String(init.body)), { phone: '5583999990000', message: 'olá' })
})

test('enviarTexto falha alto quando a Z-API recusa', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response('{"error":"null not allowed"}', { status: 400 }))
  await assert.rejects(enviarTexto('1', 'x'), /Z-API send-text 400/)
})
