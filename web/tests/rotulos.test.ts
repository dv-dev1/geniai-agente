import assert from 'node:assert/strict'
import { test } from 'node:test'
import { funil, haQuanto } from '../lib/rotulos.ts'

test('funil conta quem chegou pelo menos até a etapa e a conversão sobre a anterior', () => {
  const f = funil({ novo: 2, triagem: 3, apresentacao: 1, interesse: 2, encaminhado: 2, perdido: 4 })
  assert.deepEqual(
    f.degraus.map((d) => [d.rotulo, d.n, d.conversao]),
    [
      ['Primeiro contato', 10, null],
      ['Identificado', 8, 80],
      ['Necessidade mapeada', 5, 63],
      ['Produto apresentado', 4, 80],
      ['Com especialista', 2, 50],
    ],
  )
  assert.equal(f.foraDoPerfil, 4)
})

test('funil vazio não divide por zero', () => {
  assert.deepEqual(
    funil({}).degraus.map((d) => d.conversao),
    [null, 0, 0, 0, 0],
  )
})

test('última atividade em minutos, horas ou dias', () => {
  const agora = Date.parse('2026-09-24T12:00:00Z')
  assert.equal(haQuanto('2026-09-24T11:59:50Z', agora), 'há 1 min')
  assert.equal(haQuanto('2026-09-24T09:00:00Z', agora), 'há 3 h')
  assert.equal(haQuanto('2026-09-21T12:00:00Z', agora), 'há 3 d')
})
