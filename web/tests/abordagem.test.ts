import assert from 'node:assert/strict'
import { test } from 'node:test'
import { linkWhatsApp, mensagemDoEspecialista } from '../lib/abordagem.ts'

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
