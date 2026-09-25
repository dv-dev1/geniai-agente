import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Pedido, Veredito } from '../lib/cerebro.ts'
import { AVISO_ENCAMINHADO, type Deps, FALHA, receber } from '../lib/fluxo.ts'
import type { Lead, Turno } from '../lib/tipos.ts'
import type { Evento } from '../lib/zapi.ts'

type Linha = { id: string; contato: string; autor: Turno['autor']; texto: string; respondida: boolean; em: number }
type Ficha = {
  phone: string
  lead: Lead
  pausado: boolean
  temperatura?: string
  etapa?: string
  sessaoInicio: number
  encerradaEm: number | null
}
const MINUTO = 60_000

function montar(veredito: Partial<Veredito> | Error = {}) {
  const mensagens: Linha[] = []
  const contatos = new Map<string, Ficha>()
  const enviadas: { phone: string; texto: string }[] = []
  const pedidos: Pedido[] = []
  const relogio = { agora: 0 }
  const daSessao = (id: string) => {
    const c = contatos.get(id)
    return mensagens.filter((m) => m.contato === id && m.em >= (c?.sessaoInicio ?? 0))
  }
  const d: Deps = {
    debounceMs: 0,
    esperar: () => new Promise((r) => setTimeout(r, 5)),
    enviar: async (phone, texto) => {
      enviadas.push({ phone, texto })
      return `BOT${enviadas.length}`
    },
    cerebro: async (p) => {
      pedidos.push(p)
      if (veredito instanceof Error) throw veredito
      return {
        mensagem: 'olá!',
        acao: 'continuar',
        lead: {},
        score: 0,
        temperatura: 'frio',
        etapa: 'novo',
        ...veredito,
      }
    },
    db: {
      async registrarMensagem(m) {
        if (mensagens.some((x) => x.id === m.id)) return false
        if (!contatos.has(m.contato))
          contatos.set(m.contato, {
            phone: m.phone,
            lead: {},
            pausado: false,
            sessaoInicio: relogio.agora,
            encerradaEm: null,
          })
        mensagens.push({
          id: m.id,
          contato: m.contato,
          autor: m.autor,
          texto: m.texto,
          respondida: m.autor !== 'cliente',
          em: relogio.agora,
        })
        return true
      },
      async ultimaDoCliente(c) {
        return mensagens.filter((m) => m.contato === c && m.autor === 'cliente').at(-1)?.id ?? null
      },
      async reivindicarPendentes(c) {
        const p = mensagens.filter((m) => m.contato === c && m.autor === 'cliente' && !m.respondida)
        for (const m of p) m.respondida = true
        return p.length
      },
      async historico(c) {
        return daSessao(c).map(({ autor, texto }) => ({ autor, texto }))
      },
      async carregarContato(id) {
        const c = contatos.get(id)
        if (!c) throw new Error(`contato ${id} não existe`)
        const doContato = mensagens.filter((m) => m.contato === id)
        const ultima = Math.max(-Infinity, ...doContato.filter((m) => m.respondida).map((m) => m.em))
        return {
          id,
          phone: c.phone,
          lead: c.lead,
          pausado: c.pausado,
          msgsBot: daSessao(id).filter((m) => m.autor === 'bot').length,
          ociosa: ultima < relogio.agora - 30 * MINUTO,
          encerrada: c.encerradaEm !== null,
          encaminhado: c.etapa === 'encaminhado',
          avisada: doContato.some((m) => m.autor === 'bot' && c.encerradaEm !== null && m.em > c.encerradaEm),
        }
      },
      async salvarLead(id, lead, _score, temp, etapa) {
        Object.assign(contatos.get(id) ?? {}, { lead, temperatura: temp, etapa })
      },
      async abrirSessao(id) {
        const pendentes = mensagens.filter((m) => m.contato === id && m.autor === 'cliente' && !m.respondida)
        Object.assign(contatos.get(id) ?? {}, {
          sessaoInicio: Math.min(...pendentes.map((m) => m.em)),
          encerradaEm: null,
        })
      },
      async encerrar(id) {
        relogio.agora += 1
        Object.assign(contatos.get(id) ?? {}, { encerradaEm: relogio.agora })
        relogio.agora += 1
      },
      async pausar(id) {
        Object.assign(contatos.get(id) ?? {}, { pausado: true })
      },
    },
  }
  return { d, mensagens, contatos, enviadas, pedidos, relogio }
}

const cliente = (id: string, texto = 'oi', phone = '5583999990000'): Evento => ({
  tipo: 'cliente',
  id,
  contato: 'C1',
  phone,
  nome: 'Ana',
  texto,
})

test('três mensagens seguidas geram uma resposta só', async () => {
  const f = montar()
  await Promise.all([
    receber(cliente('1', 'oi'), f.d),
    receber(cliente('2', 'tudo bem?'), f.d),
    receber(cliente('3', 'quero automação'), f.d),
  ])
  assert.equal(f.enviadas.length, 1)
  assert.deepEqual(
    f.pedidos[0].historico.map((t) => t.texto),
    ['oi', 'tudo bem?', 'quero automação'],
  )
})

const passo = () => new Promise((r) => setTimeout(r, 0))

test('espera o cliente parar de digitar: mensagens espaçadas dentro da janela geram uma resposta só', async () => {
  const f = montar()
  const esperas: (() => void)[] = []
  f.d.esperar = () => new Promise<void>((r) => esperas.push(r))
  const p1 = receber(cliente('1', 'oi'), f.d)
  await passo()
  const p2 = receber(cliente('2', 'tudo bem?'), f.d)
  await passo()
  esperas[0]()
  await p1
  const p3 = receber(cliente('3', 'quero automação'), f.d)
  await passo()
  esperas[1]()
  await p2
  esperas[2]()
  await p3
  assert.equal(f.enviadas.length, 1)
  assert.deepEqual(
    f.pedidos[0].historico.map((t) => t.texto),
    ['oi', 'tudo bem?', 'quero automação'],
  )
})

test('reentrega da mesma mensagem não responde de novo', async () => {
  const f = montar()
  await receber(cliente('1'), f.d)
  await receber(cliente('1'), f.d)
  assert.equal(f.enviadas.length, 1)
})

test('atendente respondendo pelo celular tira o bot da conversa', async () => {
  const f = montar()
  await receber({ tipo: 'humano', id: 'H1', contato: 'C1', phone: '5583999990000', texto: 'Oi, aqui é o Pedro' }, f.d)
  await receber(cliente('2'), f.d)
  assert.equal(f.enviadas.length, 0)
})

test('até 30 min depois de encaminhar, avisa uma vez só e não chama o cérebro', async () => {
  const f = montar({ acao: 'encaminhar_humano', etapa: 'encaminhado' })
  await receber(cliente('1'), f.d)
  f.relogio.agora += 10 * MINUTO
  await receber(cliente('2', 'oi?'), f.d)
  await receber(cliente('3', 'alguém?'), f.d)
  assert.deepEqual(
    f.enviadas.map((e) => e.texto),
    ['olá!', AVISO_ENCAMINHADO],
  )
  assert.equal(f.pedidos.length, 1)
})

test('encerrada sem encaminhar, fica em silêncio dentro dos 30 min', async () => {
  const f = montar({ acao: 'encerrar', etapa: 'perdido' })
  await receber(cliente('1'), f.d)
  f.relogio.agora += 5 * MINUTO
  await receber(cliente('2', 'oi?'), f.d)
  assert.equal(f.enviadas.length, 1)
})

test('30 min sem mensagem abrem sessão nova: o cérebro vê só a sessão nova, com o lead de antes', async () => {
  const f = montar({ acao: 'encaminhar_humano', etapa: 'encaminhado', lead: { nome: 'Ana' } })
  await receber(cliente('1', 'quero o Audiobot'), f.d)
  f.relogio.agora += 31 * MINUTO
  await receber(cliente('2', 'oi de novo'), f.d)
  assert.equal(f.pedidos.length, 2)
  assert.deepEqual(
    f.pedidos[1].historico.map((t) => t.texto),
    ['oi de novo'],
  )
  assert.equal(f.pedidos[1].msgs_bot, 0)
  assert.deepEqual(f.pedidos[1].lead, { nome: 'Ana' })
})

test('cérebro fora do ar manda mensagem de falha e encerra a sessão', async () => {
  const f = montar(new Error('cérebro 500'))
  await receber(cliente('1'), f.d)
  assert.deepEqual(f.enviadas, [{ phone: '5583999990000', texto: FALHA }])
  assert.notEqual(f.contatos.get('C1')?.encerradaEm, null)
})

test('contato só com @lid avisa o cérebro que falta telefone', async () => {
  const f = montar()
  await receber(cliente('1', 'oi', '999@lid'), f.d)
  assert.equal(f.pedidos[0].telefone_conhecido, false)
})

test('veredito do cérebro é salvo e a resposta entra no histórico', async () => {
  const f = montar({ temperatura: 'quente', lead: { porte: 'ME' } })
  await receber(cliente('1'), f.d)
  assert.equal(f.contatos.get('C1')?.temperatura, 'quente')
  const { em: _em, ...ultima } = f.mensagens.at(-1) ?? { em: 0 }
  assert.deepEqual(ultima, { id: 'BOT1', contato: 'C1', autor: 'bot', texto: 'olá!', respondida: true })
})

test('evento ignorado não toca em nada', async () => {
  const f = montar()
  await receber({ tipo: 'ignorar' }, f.d)
  assert.equal(f.mensagens.length, 0)
})
