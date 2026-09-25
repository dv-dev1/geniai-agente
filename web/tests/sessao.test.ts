import assert from 'node:assert/strict'
import { test } from 'node:test'
import { SignJWT } from 'jose'
import { credenciaisValidas, criarToken, destinoSeguro, validarToken } from '../lib/sessao.ts'

process.env.AUTH_SECRET = 'segredo-de-teste-com-tamanho-suficiente'
process.env.DASHBOARD_USER = 'geniai'
process.env.DASHBOARD_PASSWORD = 'senha-certa'
process.env.DEMO_USER = 'demo'
process.env.DEMO_PASSWORD = 'facil'

const assinar = (segredo: string, exp: string | number) =>
  new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('geniai')
    .setExpirationTime(exp)
    .sign(new TextEncoder().encode(segredo))

test('token criado no login abre o painel', async () => {
  assert.equal(await validarToken(await criarToken('geniai')), 'geniai')
})

test('token adulterado, de outro segredo, vencido ou sem assinatura não abre', async () => {
  const bom = await criarToken('geniai')
  const [cabecalho, corpo, assinatura] = bom.split('.')
  const outroCorpo = Buffer.from(JSON.stringify({ sub: 'admin', exp: 9999999999 })).toString('base64url')
  const semAssinatura = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${corpo}.`
  assert.equal(await validarToken(`${cabecalho}.${outroCorpo}.${assinatura}`), null)
  assert.equal(await validarToken(await assinar('outro-segredo-qualquer-bem-comprido', '7d')), null)
  assert.equal(
    await validarToken(await assinar(process.env.AUTH_SECRET as string, Math.floor(Date.now() / 1000) - 60)),
    null,
  )
  assert.equal(await validarToken(semAssinatura), null)
  assert.equal(await validarToken(undefined), null)
})

test('sem AUTH_SECRET configurado, nada abre', async () => {
  const token = await criarToken('geniai')
  const segredo = process.env.AUTH_SECRET
  delete process.env.AUTH_SECRET
  try {
    assert.equal(await validarToken(token), null)
  } finally {
    process.env.AUTH_SECRET = segredo
  }
})

test('credenciais: cada par do ambiente abre o próprio usuário, e só ele', () => {
  assert.equal(credenciaisValidas('geniai', 'senha-certa'), 'geniai')
  assert.equal(credenciaisValidas('geniai', 'senha-errada'), null)
  assert.equal(credenciaisValidas('outro', 'senha-certa'), null)
  assert.equal(credenciaisValidas('geniai', ''), null)
  assert.equal(credenciaisValidas('demo', 'facil'), 'demo')
  assert.equal(credenciaisValidas('geniai', 'facil'), null)
  assert.equal(credenciaisValidas('demo', 'senha-certa'), null)
})

test('depois do login só volta para caminho do próprio painel', () => {
  assert.equal(destinoSeguro('/leads?etapa=novo'), '/leads?etapa=novo')
  assert.equal(destinoSeguro('//evil.com'), '/')
  assert.equal(destinoSeguro('/\\evil.com'), '/')
  assert.equal(destinoSeguro('/\t/evil.com'), '/')
  assert.equal(destinoSeguro('/\n/evil.com'), '/')
  assert.equal(destinoSeguro('https://evil.com'), '/')
  assert.equal(destinoSeguro(null), '/')
})
