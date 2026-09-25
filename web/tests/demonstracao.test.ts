import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ehTelefoneDemo } from '../lib/db.ts'

test('só os números da lista de apresentação vão para o banco fictício', () => {
  const lista = '+55 83 8746-8188, 5581999990000'
  assert.equal(ehTelefoneDemo('558387468188', lista), true)
  assert.equal(ehTelefoneDemo('5583987468188', lista), true)
  assert.equal(ehTelefoneDemo('558199990000', lista), true)
  assert.equal(ehTelefoneDemo('5583999990000', lista), false)
  assert.equal(ehTelefoneDemo('232594021068984@lid', lista), false)
  assert.equal(ehTelefoneDemo('558387468188', undefined), false)
  assert.equal(ehTelefoneDemo('558387468188', ''), false)
})
