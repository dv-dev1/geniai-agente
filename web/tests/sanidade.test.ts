import assert from 'node:assert/strict'
import { test } from 'node:test'

test('node roda teste em TypeScript', () => {
  const soma = (a: number, b: number): number => a + b
  assert.equal(soma(2, 2), 4)
})
