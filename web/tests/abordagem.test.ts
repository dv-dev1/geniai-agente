import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatarTelefone, linkWhatsApp, mensagemDoEspecialista, trechos } from '../lib/abordagem.ts'

test('abordagem cita o que a Gê levantou: nome, produto, plano, empresa e dor', () => {
  const lead = { nome: 'Cauê', empresa: 'Rolafit', servicos: ['audiobot'], plano: 'padrao', dor: 'organizar as salas' }
  assert.equal(
    mensagemDoEspecialista(lead, 'cauê'),
    'Olá, Cauê! Sou especialista da GeniAI. Vi que você conversou com a Gê sobre o Audiobot (plano Padrão) para a Rolafit, com foco em organizar as salas. Podemos seguir por aqui?',
  )
})

test('sem dados do lead a abordagem continua educada e usa o nome do WhatsApp', () => {
  assert.equal(
    mensagemDoEspecialista({ servicos: [] }, 'Ana'),
    'Olá, Ana! Sou especialista da GeniAI. Vi que você conversou com a Gê. Podemos seguir por aqui?',
  )
})

test('link do wa.me leva só os dígitos do telefone e o texto codificado', () => {
  assert.equal(linkWhatsApp('+55 (83) 8746-8188', 'Olá, Ana!'), 'https://wa.me/558387468188?text=Ol%C3%A1%2C%20Ana!')
})

test('número sem código do país ganha o 55; o wa.me exige o formato internacional', () => {
  assert.equal(linkWhatsApp('(83) 99999-0000', ''), 'https://wa.me/5583999990000?text=')
  assert.equal(linkWhatsApp('5583999990000', ''), 'https://wa.me/5583999990000?text=')
})

test('telefone aparece no formato brasileiro', () => {
  assert.equal(formatarTelefone('5583991000137'), '+55 83 99100-0137')
  assert.equal(formatarTelefone('558387468188'), '+55 83 8746-8188')
  assert.equal(formatarTelefone('123'), '123')
})

test('*negrito* do WhatsApp vira trecho em destaque, o resto fica texto', () => {
  assert.deepEqual(trechos('o *Audiobot* custa *R$ 399*.'), [
    ['o ', false],
    ['Audiobot', true],
    [' custa ', false],
    ['R$ 399', true],
    ['.', false],
  ])
  assert.deepEqual(trechos('2 * 3 = 6'), [['2 * 3 = 6', false]])
})
